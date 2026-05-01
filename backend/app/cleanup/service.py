import json
import os
import re
import subprocess
from pathlib import Path

from .schemas import CleanableItem, CleanupActionResult, CleanupResult, CleanupScanResult


def _run(cmd: list[str], timeout: int = 120, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kwargs)


def _parse_reclaimed(output: str) -> int:
    """Parse 'Total reclaimed space: 1.23GB' from docker prune output."""
    m = re.search(r"Total reclaimed space:\s*([\d.]+)\s*(GB|MB|kB|B)", output, re.IGNORECASE)
    if not m:
        return 0
    val = float(m.group(1))
    unit = m.group(2).upper()
    if unit == "GB": return int(val * 1024 ** 3)
    if unit == "MB": return int(val * 1024 ** 2)
    if unit == "KB": return int(val * 1024)
    return int(val)


def _dir_size(path: Path) -> int:
    total = 0
    try:
        for f in path.rglob("*"):
            if f.is_file():
                try:
                    total += f.stat().st_size
                except OSError:
                    pass
    except PermissionError:
        pass
    return total


def _docker_available() -> bool:
    try:
        r = _run(["docker", "info"])
        return r.returncode == 0
    except FileNotFoundError:
        return False


def scan() -> CleanupScanResult:
    items: list[CleanableItem] = []

    docker_ok = _docker_available()

    # ── Docker dangling images ──────────────────────────────────────────────
    if docker_ok:
        r = _run(["docker", "images", "-f", "dangling=true", "--format", "{{.ID}}\t{{.Size}}"])
        lines = [l for l in r.stdout.strip().splitlines() if l]
        size = 0
        for line in lines:
            parts = line.split("\t")
            if len(parts) == 2:
                raw = parts[1].strip()
                try:
                    if raw.endswith("GB"):
                        size += int(float(raw[:-2]) * 1024 ** 3)
                    elif raw.endswith("MB"):
                        size += int(float(raw[:-2]) * 1024 ** 2)
                    elif raw.endswith("kB"):
                        size += int(float(raw[:-2]) * 1024)
                    elif raw.endswith("B"):
                        size += int(float(raw[:-1]))
                except ValueError:
                    pass
        items.append(CleanableItem(
            key="docker_images",
            label="Unused Docker images",
            description="Untagged images not used by any container (dangling + unreferenced)",
            size_bytes=size,
            count=len(lines),
        ))

    # ── Docker stopped containers ───────────────────────────────────────────
    if docker_ok:
        r = _run(["docker", "ps", "-a", "-f", "status=exited", "-f", "status=dead", "--format", "{{.ID}}"])
        ids = [l for l in r.stdout.strip().splitlines() if l]
        items.append(CleanableItem(
            key="docker_containers",
            label="Stopped Docker containers",
            description="Containers that are stopped/exited and can be removed",
            size_bytes=0,
            count=len(ids),
        ))

    # ── Docker unused volumes ───────────────────────────────────────────────
    if docker_ok:
        r = _run(["docker", "volume", "ls", "-f", "dangling=true", "--format", "{{.Name}}"])
        names = [l for l in r.stdout.strip().splitlines() if l]
        items.append(CleanableItem(
            key="docker_volumes",
            label="Unused Docker volumes",
            description="Volumes not attached to any container",
            size_bytes=0,
            count=len(names),
        ))

    # ── Docker build cache ──────────────────────────────────────────────────
    if docker_ok:
        r = _run(["docker", "system", "df", "--format", "{{json .}}"])
        cache_bytes = 0
        for line in r.stdout.strip().splitlines():
            try:
                obj = json.loads(line)
                if obj.get("Type") == "Build Cache":
                    raw = obj.get("Size", "0B")
                    if raw.endswith("GB"):
                        cache_bytes = int(float(raw[:-2]) * 1024 ** 3)
                    elif raw.endswith("MB"):
                        cache_bytes = int(float(raw[:-2]) * 1024 ** 2)
                    elif raw.endswith("kB"):
                        cache_bytes = int(float(raw[:-2]) * 1024)
                    elif raw.endswith("B"):
                        cache_bytes = int(float(raw[:-1]))
            except (json.JSONDecodeError, ValueError):
                pass
        items.append(CleanableItem(
            key="docker_build_cache",
            label="Docker build cache",
            description="Cached layers from docker build commands",
            size_bytes=cache_bytes,
        ))

    # ── APT package cache ───────────────────────────────────────────────────
    apt_cache = Path("/var/cache/apt/archives")
    if apt_cache.exists():
        debs = list(apt_cache.glob("*.deb"))
        size = sum(f.stat().st_size for f in debs)
        items.append(CleanableItem(
            key="apt_cache",
            label="APT package cache",
            description="Downloaded .deb files cached by apt",
            size_bytes=size,
            count=len(debs),
        ))

    # ── APT autoremove ──────────────────────────────────────────────────────
    r = _run(["apt-get", "autoremove", "--dry-run"])
    if r.returncode == 0:
        lines = [l for l in r.stdout.splitlines() if "automatically installed" not in l and l.startswith(" ")]
        pkg_count = len(lines)
        items.append(CleanableItem(
            key="apt_autoremove",
            label="Orphaned APT packages",
            description="Packages installed as dependencies but no longer needed",
            size_bytes=0,
            count=pkg_count,
            available=pkg_count > 0,
        ))

    # ── Compressed log archives ─────────────────────────────────────────────
    log_dir = Path("/var/log")
    gz_files = []
    try:
        gz_files = list(log_dir.rglob("*.gz"))
    except PermissionError:
        pass
    gz_size = sum(f.stat().st_size for f in gz_files if f.is_file())
    items.append(CleanableItem(
        key="log_archives",
        label="Compressed log archives",
        description="Rotated log files (.gz) in /var/log",
        size_bytes=gz_size,
        count=len(gz_files),
        available=len(gz_files) > 0,
    ))

    # ── /tmp directory ──────────────────────────────────────────────────────
    tmp = Path("/tmp")
    tmp_size = _dir_size(tmp)
    tmp_count = sum(1 for _ in tmp.iterdir()) if tmp.exists() else 0
    items.append(CleanableItem(
        key="tmp_files",
        label="Temporary files (/tmp)",
        description="Files in /tmp older than 1 day",
        size_bytes=tmp_size,
        count=tmp_count,
        available=tmp_size > 0,
    ))

    total = sum(i.size_bytes for i in items)
    return CleanupScanResult(items=items, total_bytes=total)


def run_cleanup(actions: list[str]) -> CleanupResult:
    results: list[CleanupActionResult] = []
    docker_ok = _docker_available()

    def add(key: str, ok: bool, freed: int, msg: str):
        results.append(CleanupActionResult(key=key, ok=ok, freed_bytes=freed, message=msg))

    # Order matters: containers must be pruned before images (stopped containers
    # hold references to images, preventing image prune from removing them).
    # Volumes must come after containers for the same reason.

    if "docker_containers" in actions and docker_ok:
        try:
            r = _run(["docker", "container", "prune", "-f"], timeout=300)
            freed = _parse_reclaimed(r.stdout)
            add("docker_containers", r.returncode == 0, freed,
                r.stdout.strip() or r.stderr.strip() or "Done")
        except Exception as e:
            add("docker_containers", False, 0, str(e))

    if "docker_images" in actions and docker_ok:
        try:
            r = _run(["docker", "image", "prune", "-f", "--all"], timeout=300)
            freed = _parse_reclaimed(r.stdout)
            add("docker_images", r.returncode == 0, freed,
                r.stdout.strip() or r.stderr.strip() or "Done")
        except Exception as e:
            add("docker_images", False, 0, str(e))

    if "docker_volumes" in actions and docker_ok:
        try:
            r = _run(["docker", "volume", "prune", "-f"], timeout=300)
            freed = _parse_reclaimed(r.stdout)
            add("docker_volumes", r.returncode == 0, freed,
                r.stdout.strip() or r.stderr.strip() or "Done")
        except Exception as e:
            add("docker_volumes", False, 0, str(e))

    if "docker_build_cache" in actions and docker_ok:
        try:
            r = _run(["docker", "builder", "prune", "-f", "--all"], timeout=600)
            freed = _parse_reclaimed(r.stdout)
            add("docker_build_cache", r.returncode == 0, freed,
                r.stdout.strip() or r.stderr.strip() or "Done")
        except subprocess.TimeoutExpired:
            add("docker_build_cache", False, 0,
                "Timed out — build cache prune can be very slow. Run manually: docker builder prune -f --all")
        except Exception as e:
            add("docker_build_cache", False, 0, str(e))

    if "apt_cache" in actions:
        try:
            r = _run(["apt-get", "clean"], timeout=120)
            add("apt_cache", r.returncode == 0, 0, "APT cache cleared" if r.returncode == 0 else r.stderr.strip())
        except Exception as e:
            add("apt_cache", False, 0, str(e))

    if "apt_autoremove" in actions:
        try:
            r = _run(["apt-get", "autoremove", "-y", "--purge"], timeout=300,
                     env={**os.environ, "DEBIAN_FRONTEND": "noninteractive"})
            out = r.stdout.strip()[-400:] or "Done"
            add("apt_autoremove", r.returncode == 0, 0, out)
        except Exception as e:
            add("apt_autoremove", False, 0, str(e))

    if "log_archives" in actions:
        freed = 0
        removed = 0
        errors = 0
        for f in Path("/var/log").rglob("*.gz"):
            try:
                freed += f.stat().st_size
                f.unlink()
                removed += 1
            except OSError:
                errors += 1
        msg = f"Removed {removed} compressed log files"
        if errors:
            msg += f" ({errors} errors)"
        add("log_archives", errors == 0, freed, msg)

    if "tmp_files" in actions:
        freed = 0
        removed = 0
        import time
        cutoff = time.time() - 86400
        for f in Path("/tmp").iterdir():
            try:
                if f.stat().st_mtime < cutoff:
                    sz = f.stat().st_size if f.is_file() else _dir_size(f)
                    if f.is_file():
                        f.unlink()
                    else:
                        import shutil
                        shutil.rmtree(f, ignore_errors=True)
                    freed += sz
                    removed += 1
            except OSError:
                pass
        add("tmp_files", True, freed, f"Removed {removed} old items from /tmp")

    total_freed = sum(r.freed_bytes for r in results)
    return CleanupResult(results=results, total_freed_bytes=total_freed)

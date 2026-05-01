import subprocess
from pathlib import Path

from app.compose.schemas import ComposeActionResponse, ComposeProject

_SEARCH_DIRS = [
    "/opt",
    "/srv",
    "/home",
    "/root",
    "/var/lib",
]
_COMPOSE_FILENAMES = {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}
_MAX_DEPTH = 4


def _find_compose_files() -> list[Path]:
    found: list[Path] = []
    for base in _SEARCH_DIRS:
        p = Path(base)
        if not p.exists():
            continue
        try:
            for compose_file in p.rglob("docker-compose.y*ml"):
                if compose_file.name in _COMPOSE_FILENAMES:
                    # Limit depth
                    try:
                        rel = compose_file.relative_to(p)
                        if len(rel.parts) <= _MAX_DEPTH:
                            found.append(compose_file)
                    except ValueError:
                        pass
            for compose_file in p.rglob("compose.y*ml"):
                if compose_file.name in _COMPOSE_FILENAMES and compose_file not in found:
                    try:
                        rel = compose_file.relative_to(p)
                        if len(rel.parts) <= _MAX_DEPTH:
                            found.append(compose_file)
                    except ValueError:
                        pass
        except PermissionError:
            continue
    return list({str(f): f for f in found}.values())  # deduplicate


def _parse_services(compose_file: Path) -> list[str]:
    try:
        import yaml  # type: ignore
        with open(compose_file) as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict) and "services" in data:
            return list(data["services"].keys())
    except Exception:
        pass
    return []


def _get_project_status(compose_file: Path) -> str:
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", str(compose_file), "ps", "--format", "json"],
            capture_output=True, text=True, timeout=10, cwd=str(compose_file.parent),
        )
        if result.returncode != 0:
            return "unknown"
        import json
        containers = []
        for line in result.stdout.strip().splitlines():
            try:
                containers.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        if not containers:
            return "stopped"
        running = sum(1 for c in containers if c.get("State", "").lower() == "running")
        if running == len(containers):
            return "running"
        if running == 0:
            return "stopped"
        return "partial"
    except Exception:
        return "unknown"


def list_compose_projects() -> list[ComposeProject]:
    projects = []
    seen_dirs: set[str] = set()
    for f in _find_compose_files():
        dir_str = str(f.parent)
        if dir_str in seen_dirs:
            continue
        seen_dirs.add(dir_str)
        name = f.parent.name
        services = _parse_services(f)
        status = _get_project_status(f)
        projects.append(ComposeProject(
            name=name,
            path=str(f.parent),
            file=str(f),
            services=services,
            status=status,
        ))
    return projects


def _run_compose_action(compose_file: str, action: str) -> ComposeActionResponse:
    f = Path(compose_file)
    name = f.parent.name
    valid_actions = {"up", "down", "pull", "restart", "stop"}
    if action not in valid_actions:
        return ComposeActionResponse(success=False, project=name, action=action, output="Invalid action")

    cmd = ["docker", "compose", "-f", str(f), action]
    if action == "up":
        cmd.append("-d")

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300, cwd=str(f.parent),
        )
        output = (result.stdout + result.stderr).strip()
        return ComposeActionResponse(
            success=result.returncode == 0,
            project=name,
            action=action,
            output=output[-4000:] if len(output) > 4000 else output,
        )
    except Exception as exc:
        return ComposeActionResponse(success=False, project=name, action=action, output=str(exc))

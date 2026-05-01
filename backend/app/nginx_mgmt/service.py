import os
import re
import subprocess
from pathlib import Path

from fastapi import HTTPException, status

from .schemas import (
    NginxActionResult,
    NginxConfigResponse,
    NginxSite,
    NginxSiteList,
    NginxStatus,
    NginxTestResult,
)

_SITES_AVAILABLE = Path("/etc/nginx/sites-available")
_SITES_ENABLED = Path("/etc/nginx/sites-enabled")
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9._-]{1,120}$")


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=15)


def _nginx_version() -> str | None:
    r = _run(["nginx", "-v"])
    output = (r.stderr + r.stdout).strip()
    m = re.search(r"nginx/(\S+)", output)
    return m.group(1) if m else None


def _nginx_running() -> bool:
    r = _run(["systemctl", "is-active", "nginx"])
    return r.stdout.strip() == "active"


def get_status() -> NginxStatus:
    try:
        version = _nginx_version()
    except FileNotFoundError:
        return NginxStatus(available=False)
    if version is None:
        return NginxStatus(available=False)
    r = _run(["nginx", "-t"])
    config_ok = r.returncode == 0
    return NginxStatus(
        available=True,
        version=version,
        running=_nginx_running(),
        config_test_ok=config_ok,
    )


def list_sites() -> NginxSiteList:
    if not _SITES_AVAILABLE.exists():
        return NginxSiteList(sites=[])
    enabled_names: set[str] = set()
    if _SITES_ENABLED.exists():
        for p in _SITES_ENABLED.iterdir():
            if p.is_symlink():
                target = p.resolve().name
                enabled_names.add(target)
            elif p.is_file():
                enabled_names.add(p.name)
    sites = []
    for p in sorted(_SITES_AVAILABLE.iterdir()):
        sites.append(NginxSite(
            name=p.name,
            path=str(p),
            enabled=p.name in enabled_names,
            is_default=p.name == "default",
        ))
    return NginxSiteList(sites=sites)


def _validate_name(name: str):
    if not _SAFE_NAME.match(name):
        raise HTTPException(status_code=400, detail="Invalid site name")


def read_config(name: str) -> NginxConfigResponse:
    _validate_name(name)
    path = _SITES_AVAILABLE / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Config file not found")
    return NginxConfigResponse(name=name, content=path.read_text(), path=str(path))


def write_config(name: str, content: str) -> NginxActionResult:
    _validate_name(name)
    path = _SITES_AVAILABLE / name
    path.write_text(content)
    return NginxActionResult(ok=True, message=f"Saved {name}")


def enable_site(name: str) -> NginxActionResult:
    _validate_name(name)
    src = _SITES_AVAILABLE / name
    if not src.exists():
        raise HTTPException(status_code=404, detail="Site not found")
    link = _SITES_ENABLED / name
    if link.exists() or link.is_symlink():
        return NginxActionResult(ok=True, message="Already enabled")
    link.symlink_to(src.resolve())
    return NginxActionResult(ok=True, message=f"Enabled {name}")


def disable_site(name: str) -> NginxActionResult:
    _validate_name(name)
    link = _SITES_ENABLED / name
    if link.is_symlink():
        link.unlink()
        return NginxActionResult(ok=True, message=f"Disabled {name}")
    if link.exists():
        link.unlink()
        return NginxActionResult(ok=True, message=f"Disabled {name}")
    return NginxActionResult(ok=True, message="Not enabled")


def test_config() -> NginxTestResult:
    r = _run(["nginx", "-t"])
    output = (r.stderr + r.stdout).strip()
    return NginxTestResult(ok=r.returncode == 0, output=output)


def reload_nginx() -> NginxActionResult:
    r = _run(["systemctl", "reload", "nginx"])
    if r.returncode != 0:
        return NginxActionResult(ok=False, message=r.stderr.strip() or "Reload failed")
    return NginxActionResult(ok=True, message="nginx reloaded")


def restart_nginx() -> NginxActionResult:
    r = _run(["systemctl", "restart", "nginx"])
    if r.returncode != 0:
        return NginxActionResult(ok=False, message=r.stderr.strip() or "Restart failed")
    return NginxActionResult(ok=True, message="nginx restarted")


def delete_config(name: str) -> NginxActionResult:
    _validate_name(name)
    link = _SITES_ENABLED / name
    if link.is_symlink() or link.exists():
        link.unlink()
    path = _SITES_AVAILABLE / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Config file not found")
    path.unlink()
    return NginxActionResult(ok=True, message=f"Deleted {name}")

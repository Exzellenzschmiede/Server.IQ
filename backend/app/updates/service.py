import re
import subprocess

from app.updates.schemas import PendingUpdate, UpdatesResponse, UpgradeResponse

_RE_PKG = re.compile(r"^(\S+)/\S+ (\S+) (\S+) \[upgradable from: (\S+)\]")


def get_pending_updates() -> UpdatesResponse:
    try:
        result = subprocess.run(
            ["apt", "list", "--upgradable"],
            capture_output=True, text=True, timeout=30,
        )
        updates = []
        for line in result.stdout.splitlines():
            m = _RE_PKG.match(line)
            if m:
                updates.append(PendingUpdate(
                    package=m.group(1).split("/")[0],
                    new_version=m.group(2),
                    architecture=m.group(3),
                    current_version=m.group(4),
                ))
        return UpdatesResponse(updates=updates, count=len(updates), apt_available=True)
    except FileNotFoundError:
        return UpdatesResponse(updates=[], count=0, apt_available=False)
    except Exception:
        return UpdatesResponse(updates=[], count=0, apt_available=True)


def run_upgrade() -> UpgradeResponse:
    try:
        result = subprocess.run(
            ["apt-get", "upgrade", "-y"],
            capture_output=True, text=True, timeout=300,
            env={"DEBIAN_FRONTEND": "noninteractive", "PATH": "/usr/bin:/bin:/usr/sbin:/sbin"},
        )
        success = result.returncode == 0
        output = (result.stdout + result.stderr).strip()
        return UpgradeResponse(success=success, output=output[-4000:] if len(output) > 4000 else output)
    except Exception as exc:
        return UpgradeResponse(success=False, output=str(exc))


def run_apt_update() -> UpgradeResponse:
    try:
        result = subprocess.run(
            ["apt-get", "update"],
            capture_output=True, text=True, timeout=120,
        )
        success = result.returncode == 0
        output = (result.stdout + result.stderr).strip()
        return UpgradeResponse(success=success, output=output[-4000:] if len(output) > 4000 else output)
    except Exception as exc:
        return UpgradeResponse(success=False, output=str(exc))

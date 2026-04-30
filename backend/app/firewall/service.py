import re
import subprocess

from fastapi import HTTPException, status

from .schemas import FirewallRule, FirewallStatus

_RULE_RE = re.compile(
    r"\[\s*(\d+)\]\s+(\S+(?:\s+\(v6\))?)\s+(ALLOW|DENY|REJECT|LIMIT)\s+(?:IN\s+|OUT\s+|FWD\s+)?(.*)"
)
_PORT_RE = re.compile(r"^(\d{1,5})(:\d{1,5})?(/(tcp|udp))?$")
_ACTION_RE = re.compile(r"^(allow|deny|reject|limit)$", re.IGNORECASE)


def _run(cmd: list[str], timeout: int = 10) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def get_status() -> FirewallStatus:
    try:
        r = _run(["sudo", "ufw", "status", "numbered"])
        lines = r.stdout.splitlines()
        enabled = any("Status: active" in l for l in lines)
        rules = []
        for line in lines:
            m = _RULE_RE.match(line.strip())
            if m:
                num, to, action, from_ = m.groups()
                rules.append(FirewallRule(
                    num=int(num),
                    to=to.strip(),
                    action=action.strip(),
                    from_=(from_.strip() or "Anywhere"),
                ))
        return FirewallStatus(enabled=enabled, rules=rules)
    except Exception as exc:
        return FirewallStatus(enabled=False, rules=[], error=str(exc))


def set_enabled(enable: bool) -> dict:
    action = "enable" if enable else "disable"
    try:
        r = _run(["sudo", "ufw", "--force", action])
        return {"success": r.returncode == 0, "message": (r.stdout + r.stderr).strip()}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def add_rule(port: str, protocol: str, action: str) -> dict:
    if not _PORT_RE.match(port):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid port format")
    if not _ACTION_RE.match(action):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")
    if protocol not in ("tcp", "udp", "any"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid protocol")

    spec = f"{port}/{protocol}" if protocol != "any" else port
    try:
        r = _run(["sudo", "ufw", action, spec])
        return {"success": r.returncode == 0, "message": (r.stdout + r.stderr).strip()}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def delete_rule(num: int) -> dict:
    if num < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rule number must be >= 1")
    try:
        r = _run(["sudo", "ufw", "--force", "delete", str(num)])
        return {"success": r.returncode == 0, "message": (r.stdout + r.stderr).strip()}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

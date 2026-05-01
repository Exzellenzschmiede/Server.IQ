import re
import subprocess

from app.fail2ban.schemas import Fail2banJail, Fail2banStatus, UnbanResponse

_RE_JAILS = re.compile(r"Jail list:\s*(.+)", re.DOTALL)
_RE_STAT = re.compile(r"(\w[\w ]+):\s*(\d+)")
_RE_IP_LIST = re.compile(r"Banned IP list:\s*(.*)")


def _run(args: list[str], timeout: int = 10) -> tuple[bool, str]:
    try:
        r = subprocess.run(["fail2ban-client"] + args, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, r.stdout + r.stderr
    except FileNotFoundError:
        return False, "fail2ban-client not found"
    except Exception as exc:
        return False, str(exc)


def _parse_jail_status(name: str, output: str) -> Fail2banJail:
    stats: dict[str, int] = {}
    for m in _RE_STAT.finditer(output):
        stats[m.group(1).strip().lower()] = int(m.group(2))

    banned_ips: list[str] = []
    if m := _RE_IP_LIST.search(output):
        raw = m.group(1).strip()
        if raw:
            banned_ips = [ip.strip() for ip in raw.split() if ip.strip()]

    return Fail2banJail(
        name=name,
        currently_failed=stats.get("currently failed", 0),
        total_failed=stats.get("total failed", 0),
        currently_banned=stats.get("currently banned", 0),
        total_banned=stats.get("total banned", 0),
        banned_ips=banned_ips,
    )


def get_fail2ban_status() -> Fail2banStatus:
    ok, output = _run(["status"])
    if not ok:
        return Fail2banStatus(available="not found" not in output, active=False, jails=[])

    jails_match = _RE_JAILS.search(output)
    if not jails_match:
        return Fail2banStatus(available=True, active=True, jails=[])

    jail_names = [j.strip() for j in jails_match.group(1).split(",") if j.strip()]
    jails: list[Fail2banJail] = []
    for name in jail_names:
        ok2, jail_output = _run(["status", name])
        if ok2:
            jails.append(_parse_jail_status(name, jail_output))

    return Fail2banStatus(available=True, active=True, jails=jails)


def unban_ip(jail: str, ip: str) -> UnbanResponse:
    # Validate inputs: only allow safe characters
    if not re.match(r"^[a-zA-Z0-9_-]+$", jail):
        return UnbanResponse(success=False, message="Invalid jail name")
    if not re.match(r"^[\d.:a-fA-F/]+$", ip):
        return UnbanResponse(success=False, message="Invalid IP address")

    ok, output = _run(["set", jail, "unbanip", ip])
    if ok:
        return UnbanResponse(success=True, message=f"Unbanned {ip} from {jail}")
    return UnbanResponse(success=False, message=output.strip())

import asyncio
import re
from pathlib import Path
from typing import AsyncGenerator

from app.access_log.schemas import AccessLogResponse, NginxLogEntry, SshLogEntry

_SSH_LOG_PATHS = ["/var/log/auth.log", "/var/log/secure"]
_NGINX_LOG_PATH = "/var/log/nginx/access.log"

# sshd patterns
_RE_ACCEPTED = re.compile(r"Accepted (\S+) for (\S+) from ([\d.a-f:]+) port \d+")
_RE_FAILED = re.compile(r"Failed \S+ for (?:invalid user )?(\S+) from ([\d.a-f:]+)")
_RE_INVALID = re.compile(r"Invalid user (\S+) from ([\d.a-f:]+)")
_RE_DISCONNECT = re.compile(r"Disconnected from (?:authenticating |invalid )?user (\S+) ([\d.a-f:]+)")
_RE_TIMESTAMP = re.compile(r"^(\w{3}\s+\d+\s+\d+:\d+:\d+)")

# nginx combined log format
_RE_NGINX = re.compile(
    r'([\d.a-f:]+) - \S+ \[([^\]]+)\] "(\w+) ([^ ]+) [^"]*" (\d+) (\d+) "[^"]*" "([^"]*)"'
)


def _parse_ssh_log(path: str, limit: int) -> list[SshLogEntry]:
    entries: list[SshLogEntry] = []
    try:
        with open(path, "r", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return entries

    for line in reversed(lines):
        if "sshd" not in line:
            continue
        line = line.rstrip()
        ts_match = _RE_TIMESTAMP.match(line)
        ts = ts_match.group(1) if ts_match else ""

        if m := _RE_ACCEPTED.search(line):
            entries.append(SshLogEntry(timestamp=ts, user=m.group(2), source_ip=m.group(3), event="accepted", raw=line))
        elif m := _RE_FAILED.search(line):
            entries.append(SshLogEntry(timestamp=ts, user=m.group(1), source_ip=m.group(2), event="failed", raw=line))
        elif m := _RE_INVALID.search(line):
            entries.append(SshLogEntry(timestamp=ts, user=m.group(1), source_ip=m.group(2), event="invalid", raw=line))
        elif m := _RE_DISCONNECT.search(line):
            entries.append(SshLogEntry(timestamp=ts, user=m.group(1), source_ip=m.group(2), event="disconnect", raw=line))

        if len(entries) >= limit:
            break

    return entries


def _parse_nginx_log(limit: int) -> list[NginxLogEntry]:
    entries: list[NginxLogEntry] = []
    try:
        with open(_NGINX_LOG_PATH, "r", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return entries

    for line in reversed(lines):
        if m := _RE_NGINX.match(line.strip()):
            entries.append(NginxLogEntry(
                timestamp=m.group(2),
                source_ip=m.group(1),
                method=m.group(3),
                path=m.group(4),
                status=int(m.group(5)),
                bytes_sent=int(m.group(6)),
                user_agent=m.group(7),
            ))
        if len(entries) >= limit:
            break

    return entries


def get_access_log(limit: int = 200) -> AccessLogResponse:
    ssh_entries: list[SshLogEntry] = []
    for path in _SSH_LOG_PATHS:
        if Path(path).exists():
            ssh_entries = _parse_ssh_log(path, limit)
            break

    nginx_entries = _parse_nginx_log(limit)
    return AccessLogResponse(ssh=ssh_entries, nginx=nginx_entries)


async def stream_ssh_log() -> AsyncGenerator[str, None]:
    for path in _SSH_LOG_PATHS:
        if Path(path).exists():
            log_path = path
            break
    else:
        yield "No SSH log file found"
        return

    proc = await asyncio.create_subprocess_exec(
        "tail", "-n", "50", "-f", log_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        assert proc.stdout
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace").rstrip()
            if "sshd" in decoded:
                yield decoded
    finally:
        try:
            proc.kill()
        except Exception:
            pass

import re
import subprocess
from pathlib import Path

VMAILBOX = Path("/etc/postfix/vmailbox")
VIRTUAL = Path("/etc/postfix/virtual")
MAILBASE = Path("/var/mail/vhosts")
DOVECOT_USERS = Path("/etc/dovecot/users")


def _cmd_exists(cmd: str) -> bool:
    r = subprocess.run(["which", cmd], capture_output=True, timeout=5)
    return r.returncode == 0


def _service_running(name: str) -> bool:
    r = subprocess.run(["systemctl", "is-active", "--quiet", name], timeout=5)
    return r.returncode == 0


def get_status() -> dict:
    return {
        "postfix_installed": _cmd_exists("postfix"),
        "dovecot_installed": _cmd_exists("dovecot"),
        "postfix_running": _service_running("postfix"),
        "dovecot_running": _service_running("dovecot"),
    }


def _read_file(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [l for l in path.read_text().splitlines() if l.strip() and not l.startswith("#")]


def _write_lines(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n")


def list_mailboxes() -> list[dict]:
    result = []
    for line in _read_file(VMAILBOX):
        parts = line.split()
        if len(parts) >= 1:
            email = parts[0]
            if "@" in email:
                local, domain = email.split("@", 1)
                result.append({"email": email, "domain": domain, "local_part": local})
    return result


def add_mailbox(email: str, password: str) -> None:
    if "@" not in email:
        raise ValueError("Invalid email address")
    local, domain = email.split("@", 1)

    # Add to vmailbox
    lines = _read_file(VMAILBOX)
    if any(l.split()[0] == email for l in lines if l.split()):
        raise ValueError(f"Mailbox {email} already exists")
    lines.append(f"{email}  {domain}/{local}/Maildir/")
    _write_lines(VMAILBOX, lines)
    subprocess.run(["postmap", str(VMAILBOX)], timeout=10)

    # Create Maildir
    maildir = MAILBASE / domain / local / "Maildir"
    for sub in ("cur", "new", "tmp"):
        (maildir / sub).mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(["chown", "-R", "vmail:vmail", str(MAILBASE / domain)], timeout=10)
    except Exception:
        pass

    # Set password in Dovecot users file
    pw_r = subprocess.run(["doveadm", "pw", "-s", "SHA512-CRYPT", "-p", password],
                          capture_output=True, text=True, timeout=10)
    if pw_r.returncode == 0:
        pw_hash = pw_r.stdout.strip()
        dov_lines = _read_file(DOVECOT_USERS)
        dov_lines = [l for l in dov_lines if not l.startswith(f"{email}:")]
        dov_lines.append(f"{email}:{pw_hash}")
        _write_lines(DOVECOT_USERS, dov_lines)

    try:
        subprocess.run(["postfix", "reload"], timeout=10)
    except Exception:
        pass


def delete_mailbox(email: str) -> None:
    lines = [l for l in _read_file(VMAILBOX) if not (l.split() and l.split()[0] == email)]
    _write_lines(VMAILBOX, lines)
    subprocess.run(["postmap", str(VMAILBOX)], timeout=10)

    dov_lines = [l for l in _read_file(DOVECOT_USERS) if not l.startswith(f"{email}:")]
    _write_lines(DOVECOT_USERS, dov_lines)

    try:
        subprocess.run(["postfix", "reload"], timeout=10)
    except Exception:
        pass


def list_aliases() -> list[dict]:
    result = []
    for line in _read_file(VIRTUAL):
        parts = line.split()
        if len(parts) >= 2:
            result.append({"source": parts[0], "destination": parts[1]})
    return result


def add_alias(source: str, destination: str) -> None:
    lines = _read_file(VIRTUAL)
    if any(l.split() and l.split()[0] == source for l in lines):
        raise ValueError(f"Alias {source} already exists")
    lines.append(f"{source}  {destination}")
    _write_lines(VIRTUAL, lines)
    subprocess.run(["postmap", str(VIRTUAL)], timeout=10)
    try:
        subprocess.run(["postfix", "reload"], timeout=10)
    except Exception:
        pass


def delete_alias(source: str) -> None:
    lines = [l for l in _read_file(VIRTUAL) if not (l.split() and l.split()[0] == source)]
    _write_lines(VIRTUAL, lines)
    subprocess.run(["postmap", str(VIRTUAL)], timeout=10)
    try:
        subprocess.run(["postfix", "reload"], timeout=10)
    except Exception:
        pass


def get_mail_queue() -> list[dict]:
    r = subprocess.run(["mailq"], capture_output=True, text=True, timeout=10)
    if r.returncode != 0 or "Mail queue is empty" in r.stdout:
        return []
    items: list[dict] = []
    current: dict | None = None
    for line in r.stdout.splitlines():
        m = re.match(r"^([A-F0-9]+)\s+(\d+)\s+(.+?)\s+([^\s]+)\s*$", line)
        if m:
            current = {"queue_id": m.group(1), "size": m.group(2),
                       "arrival_time": m.group(3), "sender": m.group(4),
                       "recipients": [], "status": "queued"}
            items.append(current)
        elif current and line.strip().startswith("("):
            current["status"] = line.strip("() ")
        elif current and line.strip() and not line.startswith("-"):
            current["recipients"].append(line.strip())
    return items


def flush_queue() -> None:
    subprocess.run(["postqueue", "-f"], timeout=10)


def delete_queue_item(queue_id: str) -> None:
    if not re.match(r"^[A-F0-9]+$", queue_id):
        raise ValueError("Invalid queue ID")
    subprocess.run(["postsuper", "-d", queue_id], timeout=10)

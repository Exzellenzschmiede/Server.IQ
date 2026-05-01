import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status

from .schemas import CertInfo, RenewResponse

_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9._-]{1,253}$")

_LETSENCRYPT_BASE = Path("/etc/letsencrypt/live")


def _parse_openssl_date(date_str: str) -> datetime:
    date_str = date_str.strip()
    for fmt in ("%b %d %H:%M:%S %Y %Z", "%b  %d %H:%M:%S %Y %Z"):
        try:
            return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {date_str}")


def _read_cert(cert_path: Path) -> CertInfo | None:
    domain = cert_path.parent.name
    try:
        r = subprocess.run(
            ["openssl", "x509", "-noout", "-dates", "-in", str(cert_path)],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode != 0:
            return None
        not_before = not_after = ""
        for line in r.stdout.splitlines():
            if line.startswith("notBefore="):
                not_before = line.split("=", 1)[1]
            elif line.startswith("notAfter="):
                not_after = line.split("=", 1)[1]
        if not not_after:
            return None
        expiry = _parse_openssl_date(not_after)
        now = datetime.now(timezone.utc)
        days_remaining = (expiry - now).days
        return CertInfo(
            domain=domain,
            not_before=not_before,
            not_after=not_after,
            days_remaining=days_remaining,
            expired=days_remaining < 0,
        )
    except Exception:
        return None


def renew_cert(domain: str) -> RenewResponse:
    if not _DOMAIN_RE.match(domain):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid domain name")
    cert_dir = _LETSENCRYPT_BASE / domain
    if not cert_dir.is_dir():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    try:
        r = subprocess.run(
            ["certbot", "renew", "--cert-name", domain, "--non-interactive"],
            capture_output=True, text=True, timeout=120,
        )
        output = (r.stdout + r.stderr).strip()
        return RenewResponse(domain=domain, success=r.returncode == 0, output=output)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="certbot not found")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="certbot timed out after 120 s")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def get_certs() -> list[CertInfo]:
    if not _LETSENCRYPT_BASE.exists():
        return []
    certs = []
    for domain_dir in sorted(_LETSENCRYPT_BASE.iterdir()):
        if not domain_dir.is_dir() or domain_dir.name == "README":
            continue
        cert_path = domain_dir / "cert.pem"
        if not cert_path.exists():
            continue
        info = _read_cert(cert_path)
        if info:
            certs.append(info)
    return certs

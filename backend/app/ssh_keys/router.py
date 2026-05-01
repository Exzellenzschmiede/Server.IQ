from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import get_current_user, require_admin
from app.models import User

router = APIRouter()

_AUTHORIZED_KEYS = Path.home() / ".ssh" / "authorized_keys"


def _read_keys() -> list[str]:
    if not _AUTHORIZED_KEYS.exists():
        return []
    return [line for line in _AUTHORIZED_KEYS.read_text().splitlines() if line.strip() and not line.startswith("#")]


def _write_keys(keys: list[str]) -> None:
    _AUTHORIZED_KEYS.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    _AUTHORIZED_KEYS.write_text("\n".join(keys) + ("\n" if keys else ""))
    _AUTHORIZED_KEYS.chmod(0o600)


class SshKey(BaseModel):
    index: int
    type: str
    fingerprint: str
    comment: str
    raw: str


class SshKeyAdd(BaseModel):
    key: str


def _parse_key(raw: str, index: int) -> SshKey:
    parts = raw.strip().split(None, 2)
    key_type = parts[0] if len(parts) > 0 else "unknown"
    comment = parts[2] if len(parts) > 2 else ""
    # Shortened fingerprint preview from key body
    key_body = parts[1] if len(parts) > 1 else ""
    fingerprint = f"{key_body[:12]}…{key_body[-8:]}" if len(key_body) > 20 else key_body
    return SshKey(index=index, type=key_type, fingerprint=fingerprint, comment=comment, raw=raw)


@router.get("", response_model=list[SshKey])
async def list_keys(_: User = Depends(get_current_user)):
    return [_parse_key(k, i) for i, k in enumerate(_read_keys())]


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_key(body: SshKeyAdd, _: User = Depends(require_admin)):
    key = body.key.strip()
    if not key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Key is empty")
    parts = key.split()
    if len(parts) < 2 or not parts[0].startswith("ssh-") and not parts[0].startswith("ecdsa-") and parts[0] != "sk-ecdsa-sha2-nistp256@openssh.com":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid SSH public key format")
    keys = _read_keys()
    if key in keys:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Key already exists")
    keys.append(key)
    _write_keys(keys)
    return {"ok": True}


@router.delete("/{index}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(index: int, _: User = Depends(require_admin)):
    keys = _read_keys()
    if index < 0 or index >= len(keys):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Key not found")
    keys.pop(index)
    _write_keys(keys)

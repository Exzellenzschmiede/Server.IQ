import asyncio
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import Backup, DBConnection

BACKUP_ROOT = Path("/var/backups/server-iq")


def _ensure_backup_root() -> None:
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)


def _backup_filename(name: str, btype: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    return f"{safe}_{ts}.tar.gz"


def _run_backup(backup_id: int, name: str, include_paths: list[str],
                db_conn_data: dict | None, db_name: str | None) -> None:
    """Blocking function — runs in a thread."""
    _ensure_backup_root()
    btype = "mixed" if (include_paths and db_conn_data) else ("database" if db_conn_data else "files")
    filename = _backup_filename(name, btype)
    out_path = BACKUP_ROOT / filename
    error: str | None = None

    try:
        parts: list[str] = []

        # 1. Files
        if include_paths:
            valid_paths = [p for p in include_paths if os.path.exists(p)]
            if valid_paths:
                tar_cmd = ["tar", "-czf", str(out_path), "--ignore-failed-read"] + valid_paths
                r = subprocess.run(tar_cmd, capture_output=True, text=True, timeout=600)
                if r.returncode not in (0, 1):  # 1 = files changed during backup (ok)
                    raise RuntimeError(f"tar failed: {r.stderr[:500]}")

        # 2. Database dump
        if db_conn_data and db_conn_data.get("db_type") == "postgresql":
            dump_file = BACKUP_ROOT / f"_pgdump_{backup_id}.sql"
            pg_cmd = [
                "pg_dump",
                f"--host={db_conn_data['host']}",
                f"--port={db_conn_data['port']}",
                f"--username={db_conn_data['username']}",
                "--no-password",
            ]
            if db_name:
                pg_cmd.append(db_name)
            else:
                pg_cmd = [
                    "pg_dumpall",
                    f"--host={db_conn_data['host']}",
                    f"--port={db_conn_data['port']}",
                    f"--username={db_conn_data['username']}",
                    "--no-password",
                ]
            env = os.environ.copy()
            env["PGPASSWORD"] = db_conn_data.get("password", "")
            with open(dump_file, "w") as f:
                r = subprocess.run(pg_cmd, stdout=f, stderr=subprocess.PIPE, text=True, timeout=300, env=env)
            if r.returncode != 0:
                dump_file.unlink(missing_ok=True)
                raise RuntimeError(f"pg_dump failed: {r.stderr[:500]}")

            # Add dump to tar (append or create)
            if out_path.exists():
                # Re-tar with the dump included
                new_out = BACKUP_ROOT / f"_tmp_{filename}"
                subprocess.run(["tar", "-czf", str(new_out), "-C", str(BACKUP_ROOT), dump_file.name]
                                + (["--append", "-f", str(out_path)] if False else []),
                                timeout=60)
                # Simpler: just make a new archive with all parts
                combined_cmd = ["tar", "-czf", str(new_out), "--ignore-failed-read",
                                 str(dump_file)] + (valid_paths if include_paths else [])
                subprocess.run(combined_cmd, capture_output=True, timeout=600)
                out_path.unlink(missing_ok=True)
                new_out.rename(out_path)
            else:
                archive_cmd = ["tar", "-czf", str(out_path), str(dump_file)]
                subprocess.run(archive_cmd, capture_output=True, timeout=60)
            dump_file.unlink(missing_ok=True)

        size = out_path.stat().st_size if out_path.exists() else 0
        parts = []
    except Exception as exc:
        error = str(exc)
        size = 0

    # Update DB record
    asyncio.run(_update_backup_record(backup_id, str(out_path), size, error))


async def _update_backup_record(backup_id: int, path: str, size: int, error: str | None) -> None:
    async with AsyncSessionLocal() as db:
        backup = await db.get(Backup, backup_id)
        if backup:
            backup.backup_path = path
            backup.size_bytes = size
            backup.status = "failed" if error else "completed"
            backup.error = error
            backup.completed_at = datetime.now(timezone.utc)
            await db.commit()


async def start_backup(db: AsyncSession, name: str, include_paths: list[str],
                       db_connection_id: int | None, db_name: str | None) -> Backup:
    _ensure_backup_root()
    btype = "mixed" if (include_paths and db_connection_id) else ("database" if db_connection_id else "files")

    db_conn_data: dict | None = None
    if db_connection_id:
        conn = await db.get(DBConnection, db_connection_id)
        if conn:
            db_conn_data = {"db_type": conn.db_type, "host": conn.host, "port": conn.port,
                            "username": conn.username, "password": conn.password}

    record = Backup(
        name=name,
        backup_type=btype,
        status="running",
        include_paths=json.dumps(include_paths),
        db_connection_id=db_connection_id,
        db_name=db_name,
        backup_path="",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    asyncio.get_event_loop().run_in_executor(
        None, _run_backup, record.id, name, include_paths, db_conn_data, db_name
    )
    return record


async def list_backups(db: AsyncSession) -> list[Backup]:
    result = await db.execute(select(Backup).order_by(Backup.created_at.desc()))
    return list(result.scalars().all())


async def delete_backup(db: AsyncSession, backup_id: int) -> None:
    backup = await db.get(Backup, backup_id)
    if not backup:
        return
    if backup.backup_path:
        Path(backup.backup_path).unlink(missing_ok=True)
    await db.delete(backup)
    await db.commit()

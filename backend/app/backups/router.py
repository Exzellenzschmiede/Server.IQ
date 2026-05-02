from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import User

from .schemas import BackupCreate, BackupOut
from .service import delete_backup, list_backups, start_backup, BACKUP_ROOT

router = APIRouter()


@router.get("", response_model=list[BackupOut])
async def get_backups(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await list_backups(db)


@router.post("", response_model=BackupOut, status_code=status.HTTP_202_ACCEPTED)
async def create_backup(body: BackupCreate, _: User = Depends(require_admin),
                        db: AsyncSession = Depends(get_db)):
    return await start_backup(db, body.name, body.include_paths, body.db_connection_id, body.db_name)


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_backup(backup_id: int, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    await delete_backup(db, backup_id)


@router.get("/{backup_id}/download")
async def download_backup(backup_id: int, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.models import Backup
    backup = await db.get(Backup, backup_id)
    if not backup or not backup.backup_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Backup not found")
    path = Path(backup.backup_path)
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Backup file not found on disk")
    return FileResponse(str(path), filename=path.name, media_type="application/gzip")

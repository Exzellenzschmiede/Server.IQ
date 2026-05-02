import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import require_admin
from app.models import User

from .schemas import MailAlias, MailboxCreate, MailQueueItem, MailStatus
from .service import (
    add_alias,
    add_mailbox,
    delete_alias,
    delete_mailbox,
    delete_queue_item,
    flush_queue,
    get_mail_queue,
    get_status,
    list_aliases,
    list_mailboxes,
)

router = APIRouter()


@router.get("/status", response_model=MailStatus)
async def mail_status(_: User = Depends(require_admin)):
    return await asyncio.to_thread(get_status)


@router.get("/mailboxes")
async def get_mailboxes(_: User = Depends(require_admin)):
    return await asyncio.to_thread(list_mailboxes)


@router.post("/mailboxes", status_code=status.HTTP_201_CREATED)
async def create_mailbox(body: MailboxCreate, _: User = Depends(require_admin)):
    try:
        await asyncio.to_thread(add_mailbox, body.email, body.password)
        return {"email": body.email}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/mailboxes/{email}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_mailbox(email: str, _: User = Depends(require_admin)):
    await asyncio.to_thread(delete_mailbox, email)


@router.get("/aliases")
async def get_aliases(_: User = Depends(require_admin)):
    return await asyncio.to_thread(list_aliases)


@router.post("/aliases", status_code=status.HTTP_201_CREATED)
async def create_alias(body: MailAlias, _: User = Depends(require_admin)):
    try:
        await asyncio.to_thread(add_alias, body.source, body.destination)
        return {"source": body.source, "destination": body.destination}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/aliases/{source}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_alias(source: str, _: User = Depends(require_admin)):
    await asyncio.to_thread(delete_alias, source)


@router.get("/queue", response_model=list[MailQueueItem])
async def get_queue(_: User = Depends(require_admin)):
    return await asyncio.to_thread(get_mail_queue)


@router.post("/queue/flush")
async def flush_mail_queue(_: User = Depends(require_admin)):
    await asyncio.to_thread(flush_queue)
    return {"ok": True}


@router.delete("/queue/{queue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_from_queue(queue_id: str, _: User = Depends(require_admin)):
    try:
        await asyncio.to_thread(delete_queue_item, queue_id)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))

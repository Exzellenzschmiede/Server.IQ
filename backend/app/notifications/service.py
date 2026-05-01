import asyncio
import smtplib
import socket
from email.mime.text import MIMEText

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NotificationConfig, ServiceAlertState


async def _get_or_create_config(db: AsyncSession) -> NotificationConfig:
    cfg = await db.scalar(select(NotificationConfig).where(NotificationConfig.id == 1))
    if cfg is None:
        cfg = NotificationConfig()
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


async def get_config(db: AsyncSession) -> NotificationConfig:
    return await _get_or_create_config(db)


async def update_config(db: AsyncSession, updates: dict) -> NotificationConfig:
    cfg = await _get_or_create_config(db)
    for key, value in updates.items():
        if hasattr(cfg, key):
            setattr(cfg, key, value)
    await db.commit()
    await db.refresh(cfg)
    return cfg


async def send_telegram(token: str, chat_id: str, message: str) -> bool:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
        return r.status_code == 200


def _send_email_sync(host: str, port: int, user: str | None, password: str | None,
                     from_addr: str, to_addr: str, subject: str, body: str) -> bool:
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.ehlo()
        if smtp.has_extn("STARTTLS"):
            smtp.starttls()
            smtp.ehlo()
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(from_addr, [to_addr], msg.as_string())
    return True


async def send_email(host: str, port: int, user: str | None, password: str | None,
                     from_addr: str, to_addr: str, subject: str, body: str) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: _send_email_sync(host, port, user, password, from_addr, to_addr, subject, body),
    )


async def test_notification(db: AsyncSession, channel: str) -> dict:
    cfg = await _get_or_create_config(db)
    subject = "Server.IQ — Test Message"
    body = "This is a test notification from Server.IQ."
    try:
        if channel == "telegram":
            if not cfg.telegram_enabled or not cfg.telegram_bot_token or not cfg.telegram_chat_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Telegram is not configured or disabled")
            ok = await send_telegram(cfg.telegram_bot_token, cfg.telegram_chat_id, f"<b>{subject}</b>\n{body}")
        elif channel == "email":
            if not cfg.email_enabled or not cfg.email_smtp_host or not cfg.email_from or not cfg.email_to:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Email is not configured or disabled")
            ok = await send_email(
                cfg.email_smtp_host, cfg.email_smtp_port,
                cfg.email_smtp_user, cfg.email_smtp_password,
                cfg.email_from, cfg.email_to, subject, body,
            )
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown channel")
        return {"success": ok}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def notify(cfg: NotificationConfig, message: str) -> None:
    tasks = []
    if cfg.telegram_enabled and cfg.telegram_bot_token and cfg.telegram_chat_id:
        tasks.append(send_telegram(cfg.telegram_bot_token, cfg.telegram_chat_id, message))
    if cfg.email_enabled and cfg.email_smtp_host and cfg.email_from and cfg.email_to:
        subject = "Server.IQ Alert"
        tasks.append(send_email(
            cfg.email_smtp_host, cfg.email_smtp_port,
            cfg.email_smtp_user, cfg.email_smtp_password,
            cfg.email_from, cfg.email_to, subject, message,
        ))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


def _check_tcp(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=3):
            return True
    except Exception:
        return False

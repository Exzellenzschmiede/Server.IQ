import asyncio
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.access_log.router import router as access_log_router
from app.ai.router import router as ai_router
from app.audit.router import router as audit_router
from app.auth.router import router as auth_router
from app.backups.router import router as backups_router
from app.cleanup.router import router as cleanup_router
from app.bandwidth.router import router as bandwidth_router
from app.databases.router import router as databases_router
from app.email_mgmt.router import router as email_router
from app.vhosts.router import router as vhosts_router
from app.config import settings
from app.network.router import router as network_router
from app.nginx_mgmt.router import router as nginx_router
from app.console.router import router as console_router
from app.ssh_keys.router import router as ssh_keys_router
from app.cron.router import router as cron_router
from app.database import AsyncSessionLocal, engine
from app.docker_mgmt.router import router as docker_router
from app.fail2ban.router import router as fail2ban_router
from app.files.router import router as files_router
from app.firewall.router import router as firewall_router
from app.logs.router import router as logs_router
from app.models import AlertHistory, AppConfig, AuditLog, Base, MetricSnapshot, MonitoredService, NotificationConfig, ServiceAlertState
from app.notifications.router import router as notifications_router
from app.settings.router import router as settings_router
from app.ssl_certs.router import router as ssl_router
from app.system.router import router as system_router
from app.system.service import get_all_metrics, get_services
from app.updates.router import router as updates_router
from app.users.router import router as users_router


async def _run_column_migrations(conn) -> None:
    """Add new columns to existing tables without dropping data."""
    migrations = [
        "ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(32)",
        "ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_model VARCHAR(128)",
        "ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_api_key VARCHAR(512)",
    ]
    for sql in migrations:
        try:
            await conn.execute(text(sql))
        except Exception:
            pass


async def _seed_default_services(db: AsyncSession) -> None:
    count = await db.scalar(select(func.count()).select_from(MonitoredService))
    if count == 0:
        db.add_all([
            MonitoredService(key="nginx",      display_name="NGINX",      host="127.0.0.1", port=80),
            MonitoredService(key="postgresql", display_name="PostgreSQL", host="127.0.0.1", port=5432),
            MonitoredService(key="ssh",        display_name="SSH",        host="127.0.0.1", port=22),
            MonitoredService(key="docker",     display_name="Docker",     host=None,        port=None),
        ])
        await db.commit()


async def _migrate_service_hosts(db: AsyncSession) -> None:
    await db.execute(
        update(MonitoredService)
        .where(MonitoredService.host == "host.docker.internal")
        .values(host="127.0.0.1")
    )
    await db.commit()


async def _metric_snapshot_loop() -> None:
    await asyncio.sleep(10)
    while True:
        try:
            metrics = get_all_metrics()
            disk_pct = metrics.disk[0].percent if metrics.disk else 0.0
            disk_read = metrics.disk_io.read_bytes_per_sec if metrics.disk_io else 0.0
            disk_write = metrics.disk_io.write_bytes_per_sec if metrics.disk_io else 0.0
            net_recv = sum(n.bytes_recv_per_sec for n in metrics.network)
            net_sent = sum(n.bytes_sent_per_sec for n in metrics.network)
            async with AsyncSessionLocal() as db:
                db.add(MetricSnapshot(
                    cpu_percent=metrics.cpu.percent,
                    memory_percent=metrics.memory.percent,
                    disk_percent=disk_pct,
                    disk_read_bps=disk_read,
                    disk_write_bps=disk_write,
                    net_recv_bps=net_recv,
                    net_sent_bps=net_sent,
                ))
                await db.commit()
        except Exception:
            pass
        await asyncio.sleep(60)


async def _notification_monitor_loop() -> None:
    from app.notifications.service import notify
    await asyncio.sleep(30)
    while True:
        interval = 300
        try:
            async with AsyncSessionLocal() as db:
                cfg = await db.scalar(select(NotificationConfig).where(NotificationConfig.id == 1))
                if cfg:
                    interval = cfg.check_interval_minutes * 60
                    services = await get_services(db)
                    for svc in services:
                        key = svc.name
                        is_down = svc.status in ("inactive", "failed")
                        state = await db.get(ServiceAlertState, key)
                        if state is None:
                            state = ServiceAlertState(key=key, is_down=is_down)
                            db.add(state)
                        else:
                            was_down = state.is_down
                            if is_down and not was_down and cfg.notify_on_failure:
                                msg = (
                                    f"🔴 <b>Service down</b>\n"
                                    f"Service: <b>{svc.display_name}</b>\n"
                                    f"Status: {svc.status}\n"
                                    f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
                                )
                                await notify(cfg, msg)
                                state.alerted_at = datetime.now(timezone.utc)
                                channels = []
                                if cfg.telegram_enabled and cfg.telegram_bot_token:
                                    channels.append("telegram")
                                if cfg.email_enabled and cfg.email_smtp_host:
                                    channels.append("email")
                                for ch in channels:
                                    db.add(AlertHistory(channel=ch, service_key=key, event="down", message=msg))
                            elif not is_down and was_down and cfg.notify_on_recovery:
                                msg = (
                                    f"🟢 <b>Service recovered</b>\n"
                                    f"Service: <b>{svc.display_name}</b>\n"
                                    f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
                                )
                                await notify(cfg, msg)
                                channels = []
                                if cfg.telegram_enabled and cfg.telegram_bot_token:
                                    channels.append("telegram")
                                if cfg.email_enabled and cfg.email_smtp_host:
                                    channels.append("email")
                                for ch in channels:
                                    db.add(AlertHistory(channel=ch, service_key=key, event="recovery", message=msg))
                            state.is_down = is_down
                        await db.commit()
        except Exception:
            pass
        await asyncio.sleep(interval)


# ── Upload size limit middleware ───────────────────────────────────────────────
# Cache the configured limit for 30 seconds to avoid a DB hit on every upload.
_upload_limit_cache: dict = {"bytes": 100 * 1024 * 1024, "until": 0.0}


async def _get_upload_limit_bytes() -> int:
    now = time.time()
    if now >= _upload_limit_cache["until"]:
        try:
            async with AsyncSessionLocal() as db:
                cfg = await db.scalar(select(AppConfig).where(AppConfig.id == 1))
                mb = cfg.upload_max_size_mb if cfg else 100
        except Exception:
            mb = 100
        _upload_limit_cache["bytes"] = mb * 1024 * 1024
        _upload_limit_cache["until"] = now + 30
    return _upload_limit_cache["bytes"]


_AUDIT_RULES: list[tuple[str, str, str]] = [
    # (method, path_prefix, action_label)
    ("POST",   "/api/v1/auth/login",           "auth.login"),
    ("POST",   "/api/v1/auth/logout",          "auth.logout"),
    ("POST",   "/api/v1/docker/containers/",   "docker.action"),
    ("DELETE", "/api/v1/docker/containers/",   "docker.delete"),
    ("POST",   "/api/v1/firewall/rules",       "firewall.add_rule"),
    ("DELETE", "/api/v1/firewall/rules/",      "firewall.delete_rule"),
    ("POST",   "/api/v1/files/write",          "files.write"),
    ("DELETE", "/api/v1/files/delete",         "files.delete"),
    ("POST",   "/api/v1/system/power",         "system.power"),
    ("POST",   "/api/v1/system/services/",     "system.service_action"),
    ("DELETE", "/api/v1/system/processes/",    "system.kill_process"),
    ("POST",   "/api/v1/system/processes/",    "system.renice_process"),
    ("POST",   "/api/v1/cleanup",              "cleanup.run"),
    ("POST",   "/api/v1/ssh-keys",             "ssh_keys.add"),
    ("DELETE", "/api/v1/ssh-keys/",            "ssh_keys.delete"),
    ("POST",   "/api/v1/settings",             "settings.update"),
    ("PATCH",  "/api/v1/settings",             "settings.update"),
    ("POST",   "/api/v1/users",                "users.create"),
    ("DELETE", "/api/v1/users/",               "users.delete"),
]


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        method = request.method
        path = request.url.path
        # Only log mutating operations that match a rule
        for rule_method, rule_prefix, action in _AUDIT_RULES:
            if method == rule_method and path.startswith(rule_prefix):
                if response.status_code < 400:
                    try:
                        from app.audit.service import log_action
                        from app.auth.service import decode_token
                        auth = request.headers.get("authorization", "")
                        user_email = None
                        if auth.startswith("Bearer "):
                            payload = decode_token(auth[7:])
                            if payload:
                                user_email = payload.get("sub")
                        ip = request.client.host if request.client else None
                        resource = path
                        import asyncio
                        asyncio.create_task(log_action(action, user_email, resource, None, ip))
                    except Exception:
                        pass
                break
        return response


class UploadSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path.endswith("/files/upload") and request.method == "POST":
            cl = request.headers.get("content-length")
            if cl:
                limit = await _get_upload_limit_bytes()
                if int(cl) > limit:
                    return JSONResponse(
                        {"detail": f"Upload exceeds the configured limit of {limit // (1024 * 1024)} MB"},
                        status_code=413,
                    )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_column_migrations(conn)
    async with AsyncSessionLocal() as db:
        await _seed_default_services(db)
        await _migrate_service_hosts(db)
    task1 = asyncio.create_task(_metric_snapshot_loop())
    task2 = asyncio.create_task(_notification_monitor_loop())
    yield
    task1.cancel()
    task2.cancel()
    try:
        await task1
    except asyncio.CancelledError:
        pass
    try:
        await task2
    except asyncio.CancelledError:
        pass


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Server.IQ API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(AuditMiddleware)
app.add_middleware(UploadSizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,          prefix="/api/v1/auth",          tags=["auth"])
app.include_router(system_router,        prefix="/api/v1/system",        tags=["system"])
app.include_router(docker_router,        prefix="/api/v1/docker",        tags=["docker"])
app.include_router(users_router,         prefix="/api/v1/users",         tags=["users"])
app.include_router(settings_router,      prefix="/api/v1/settings",      tags=["settings"])
app.include_router(console_router,       prefix="/api/v1/console",       tags=["console"])
app.include_router(logs_router,          prefix="/api/v1/logs",          tags=["logs"])
app.include_router(firewall_router,      prefix="/api/v1/firewall",      tags=["firewall"])
app.include_router(ssl_router,           prefix="/api/v1/ssl",           tags=["ssl"])
app.include_router(cron_router,          prefix="/api/v1/cron",          tags=["cron"])
app.include_router(files_router,         prefix="/api/v1/files",         tags=["files"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(access_log_router,    prefix="/api/v1/access-log",    tags=["access-log"])
app.include_router(updates_router,       prefix="/api/v1/updates",       tags=["updates"])
app.include_router(fail2ban_router,      prefix="/api/v1/fail2ban",      tags=["fail2ban"])
app.include_router(bandwidth_router,     prefix="/api/v1/bandwidth",     tags=["bandwidth"])
app.include_router(cleanup_router,       prefix="/api/v1/cleanup",       tags=["cleanup"])
app.include_router(nginx_router,         prefix="/api/v1/nginx",         tags=["nginx"])
app.include_router(ai_router,            prefix="/api/v1/ai",            tags=["ai"])
app.include_router(audit_router,         prefix="/api/v1/audit",         tags=["audit"])
app.include_router(ssh_keys_router,      prefix="/api/v1/ssh-keys",      tags=["ssh-keys"])
app.include_router(network_router,       prefix="/api/v1/network",       tags=["network"])
app.include_router(vhosts_router,        prefix="/api/v1/vhosts",        tags=["vhosts"])
app.include_router(databases_router,     prefix="/api/v1/databases",     tags=["databases"])
app.include_router(backups_router,       prefix="/api/v1/backups",       tags=["backups"])
app.include_router(email_router,         prefix="/api/v1/email",         tags=["email"])

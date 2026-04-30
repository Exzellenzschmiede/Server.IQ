import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.router import router as auth_router
from app.config import settings
from app.console.router import router as console_router
from app.cron.router import router as cron_router
from app.database import AsyncSessionLocal, engine
from app.docker_mgmt.router import router as docker_router
from app.files.router import router as files_router
from app.firewall.router import router as firewall_router
from app.logs.router import router as logs_router
from app.models import Base, MetricSnapshot, MonitoredService, NotificationConfig, ServiceAlertState
from app.notifications.router import router as notifications_router
from app.settings.router import router as settings_router
from app.ssl_certs.router import router as ssl_router
from app.system.router import router as system_router
from app.system.service import get_all_metrics, get_services
from app.users.router import router as users_router


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
    await asyncio.sleep(10)  # let the app start up first
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
                                    f"🔴 <b>Service ausgefallen</b>\n"
                                    f"Service: <b>{svc.display_name}</b>\n"
                                    f"Status: {svc.status}\n"
                                    f"Zeit: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
                                )
                                await notify(cfg, msg)
                                state.alerted_at = datetime.now(timezone.utc)
                            elif not is_down and was_down and cfg.notify_on_recovery:
                                msg = (
                                    f"🟢 <b>Service wiederhergestellt</b>\n"
                                    f"Service: <b>{svc.display_name}</b>\n"
                                    f"Zeit: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
                                )
                                await notify(cfg, msg)
                            state.is_down = is_down
                        await db.commit()
        except Exception:
            pass
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

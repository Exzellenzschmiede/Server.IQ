from contextlib import asynccontextmanager

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
from app.database import AsyncSessionLocal, engine
from app.docker_mgmt.router import router as docker_router
from app.logs.router import router as logs_router
from app.models import Base, MonitoredService
from app.settings.router import router as settings_router
from app.system.router import router as system_router
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
    """Migrate Docker-era host.docker.internal → 127.0.0.1 for bare-metal deployment."""
    await db.execute(
        update(MonitoredService)
        .where(MonitoredService.host == "host.docker.internal")
        .values(host="127.0.0.1")
    )
    await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await _seed_default_services(db)
        await _migrate_service_hosts(db)
    yield


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

app.include_router(auth_router,     prefix="/api/v1/auth",     tags=["auth"])
app.include_router(system_router,   prefix="/api/v1/system",   tags=["system"])
app.include_router(docker_router,   prefix="/api/v1/docker",   tags=["docker"])
app.include_router(users_router,    prefix="/api/v1/users",    tags=["users"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(console_router,  prefix="/api/v1/console",  tags=["console"])
app.include_router(logs_router,     prefix="/api/v1/logs",     tags=["logs"])

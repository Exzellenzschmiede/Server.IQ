import asyncio
import re
import subprocess

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import AppConfig, MonitoredService, User
from app.settings.schemas import (
    AppConfigOut,
    AppConfigUpdate,
    ServiceConfigCreate,
    ServiceConfigOut,
    ServiceConfigUpdate,
    ServiceScanResult,
)

router = APIRouter()


async def _get_or_create_app_config(db: AsyncSession) -> AppConfig:
    cfg = await db.scalar(select(AppConfig).where(AppConfig.id == 1))
    if cfg is None:
        cfg = AppConfig(id=1)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


@router.get("/app", response_model=AppConfigOut)
async def get_app_config(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _get_or_create_app_config(db)


@router.patch("/app", response_model=AppConfigOut)
async def patch_app_config(
    body: AppConfigUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    cfg = await _get_or_create_app_config(db)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(cfg, key, value)
    await db.commit()
    await db.refresh(cfg)
    return cfg


@router.get("/services", response_model=list[ServiceConfigOut])
async def list_services(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonitoredService).order_by(MonitoredService.id))
    return result.scalars().all()


@router.post("/services", response_model=ServiceConfigOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    body: ServiceConfigCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(select(MonitoredService).where(MonitoredService.key == body.key))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Key already exists")
    svc = MonitoredService(**body.model_dump())
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.put("/services/{service_id}", response_model=ServiceConfigOut)
async def update_service(
    service_id: int,
    body: ServiceConfigUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(MonitoredService, service_id)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(svc, field, value)
    await db.commit()
    await db.refresh(svc)
    return svc


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    svc = await db.get(MonitoredService, service_id)
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    await db.delete(svc)
    await db.commit()


# ── Known service catalogue ────────────────────────────────────────────────────
# proc_name_from_ss → (canonical_key, display_name)
_KNOWN: dict[str, tuple[str, str]] = {
    "nginx":           ("nginx",         "NGINX"),
    "apache2":         ("apache2",       "Apache"),
    "httpd":           ("httpd",         "Apache"),
    "caddy":           ("caddy",         "Caddy"),
    "traefik":         ("traefik",       "Traefik"),
    "haproxy":         ("haproxy",       "HAProxy"),
    "postgres":        ("postgresql",    "PostgreSQL"),
    "mysqld":          ("mysql",         "MySQL"),
    "mariadbd":        ("mariadb",       "MariaDB"),
    "redis-server":    ("redis",         "Redis"),
    "redis":           ("redis",         "Redis"),
    "mongod":          ("mongodb",       "MongoDB"),
    "sshd":            ("ssh",           "SSH"),
    "memcached":       ("memcached",     "Memcached"),
    "elasticsearch":   ("elasticsearch", "Elasticsearch"),
    "kibana":          ("kibana",        "Kibana"),
    "grafana-server":  ("grafana",       "Grafana"),
    "grafana":         ("grafana",       "Grafana"),
    "prometheus":      ("prometheus",    "Prometheus"),
    "node_exporter":   ("node_exporter", "Node Exporter"),
    "beam.smp":        ("rabbitmq",      "RabbitMQ"),
    "clickhouse":      ("clickhouse",    "ClickHouse"),
    "minio":           ("minio",         "MinIO"),
    "vault":           ("vault",         "HashiCorp Vault"),
    "consul":          ("consul",        "Consul"),
}

# systemd unit names that use a socket (no TCP port) → add as socket-check entries
_SOCKET_UNITS: dict[str, tuple[str, str]] = {
    "docker": ("docker", "Docker"),
}


def _run_scan(existing_keys: set[str]) -> list[ServiceScanResult]:
    candidates: dict[str, ServiceScanResult] = {}

    # -- ss -tlnp: all listening TCP ports + owning process -----------------
    try:
        r = subprocess.run(["ss", "-tlnp"], capture_output=True, text=True, timeout=10)
        for line in r.stdout.splitlines()[1:]:   # skip header
            parts = line.split()
            if len(parts) < 4:
                continue
            port_m = re.search(r":(\d+)$", parts[3])
            if not port_m:
                continue
            port = int(port_m.group(1))
            if port == 0:
                continue
            proc_m = re.search(r'"([^"]+)"', line)
            proc = proc_m.group(1) if proc_m else ""
            if not proc:
                continue

            if proc in _KNOWN:
                key, display = _KNOWN[proc]
            else:
                key = re.sub(r"[^a-zA-Z0-9._@-]", "_", proc.lower())[:32]
                display = proc.replace("-", " ").replace("_", " ").title()

            if key in existing_keys or key in candidates:
                continue
            candidates[key] = ServiceScanResult(
                key=key,
                display_name=display,
                host="127.0.0.1",
                port=port,
                description=f"Listening on :{port} · process: {proc}",
            )
    except Exception:
        pass

    # -- systemctl: socket-based services (Docker etc.) ---------------------
    try:
        r = subprocess.run(
            ["systemctl", "list-units", "--type=service", "--state=active", "--no-pager", "--plain"],
            capture_output=True, text=True, timeout=10,
        )
        for line in r.stdout.splitlines():
            parts = line.split()
            if not parts or not parts[0].endswith(".service"):
                continue
            unit = parts[0].removesuffix(".service")
            if unit not in _SOCKET_UNITS:
                continue
            key, display = _SOCKET_UNITS[unit]
            if key in existing_keys or key in candidates:
                continue
            candidates[key] = ServiceScanResult(
                key=key,
                display_name=display,
                host=None,
                port=None,
                description=f"Active systemd unit: {unit}.service · socket check",
            )
    except Exception:
        pass

    return list(candidates.values())


@router.get("/services/scan", response_model=list[ServiceScanResult])
async def scan_services(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonitoredService))
    existing_keys = {svc.key for svc in result.scalars().all()}
    return await asyncio.to_thread(_run_scan, existing_keys)

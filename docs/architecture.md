# Architecture

## Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12, FastAPI, uvicorn |
| System monitoring | psutil |
| Process control | subprocess → systemctl / journalctl / ufw / crontab |
| Docker management | aiodocker (async Docker SDK) |
| Authentication | JWT (python-jose), bcrypt (passlib) |
| Database ORM | SQLAlchemy 2 async + asyncpg |
| Database | PostgreSQL (host, not containerized) |
| WebSockets | FastAPI native WebSocket + asyncio PTY |
| Rate limiting | slowapi |
| HTTP client | httpx (Telegram notifications) |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Charts | Recharts |
| Terminal | xterm.js + @xterm/addon-fit |
| PWA | vite-plugin-pwa (Workbox) |
| Proxy / TLS | Host nginx + Let's Encrypt |
| Deployment | GitHub Actions → SSH (appleboy/ssh-action) |

---

## Repository Layout

```
Server.IQ/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, router registration, lifespan
│   │   ├── config.py            # pydantic-settings (env vars)
│   │   ├── database.py          # SQLAlchemy async engine + session
│   │   ├── models.py            # All SQLAlchemy ORM models
│   │   ├── dependencies.py      # get_current_user, require_admin
│   │   ├── auth/                # JWT login, refresh, setup wizard
│   │   ├── system/              # Metrics, services, health, processes, history
│   │   ├── docker_mgmt/         # Container CRUD + log streaming
│   │   ├── firewall/            # UFW read + write
│   │   ├── ssl_certs/           # Let's Encrypt expiry checker
│   │   ├── cron/                # crontab read / write
│   │   ├── files/               # Full filesystem browser + editor
│   │   ├── notifications/       # Telegram + SMTP config + background monitor
│   │   ├── settings/            # Monitored-service CRUD
│   │   ├── users/               # User management
│   │   ├── logs/                # App log streaming (journalctl WebSocket)
│   │   ├── console/             # PTY WebSocket terminal
│   │   └── websockets/          # WebSocket connection manager
│   ├── requirements.txt
│   └── Dockerfile               # (kept for reference, not used in production)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router, SetupGuard, ProtectedRoute
│   │   ├── api/                 # Axios client + one module per backend area
│   │   ├── auth/                # AuthContext, ProtectedRoute, RequireAdmin
│   │   ├── hooks/               # useMetrics, useContainers, useContainerLogs
│   │   ├── pages/               # One file per page/route
│   │   ├── components/
│   │   │   ├── layout/          # AppShell, Sidebar (desktop), BottomNav (mobile)
│   │   │   ├── ui/              # GaugeChart, MetricCard, StatusBadge, Spinner, Logo
│   │   │   └── containers/      # ContainerActions, LogViewer
│   │   └── types/               # TypeScript interfaces mirroring backend schemas
│   ├── public/                  # PWA manifest + icons
│   ├── vite.config.ts           # PWA plugin, /api proxy in dev
│   └── nginx.conf               # SPA fallback (used inside build container, not in production)
│
├── nginx/
│   └── server-iq.conf           # Host nginx server block (deployed by CI/CD)
│
├── .github/workflows/
│   └── deploy.yml               # CI/CD pipeline
│
├── server-iq.service            # systemd unit (User=root)
├── setup.sh                     # First-time VPS provisioning script
├── .env.example                 # Environment variable template
└── CLAUDE.md                    # AI assistant instructions
```

---

## Database Schema

All tables are created automatically at startup via `Base.metadata.create_all`.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | varchar(128) | display name |
| email | varchar(256) unique | stored lowercase |
| password_hash | varchar(256) | bcrypt |
| role | enum(admin, user) | |
| is_active | boolean | default true |
| created_at | timestamptz | server default |

### `monitored_services`
| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| key | varchar(64) unique | systemd service name |
| display_name | varchar(128) | |
| host | varchar(256) nullable | for TCP health check |
| port | integer nullable | for TCP health check |
| enabled | boolean | default true |
| created_at | timestamptz | |

### `metric_snapshots`
Collected every 60 seconds by the background task.

| Column | Type |
|---|---|
| id | integer PK autoincrement |
| recorded_at | timestamptz (indexed) |
| cpu_percent | float |
| memory_percent | float |
| disk_percent | float |
| disk_read_bps | float |
| disk_write_bps | float |
| net_recv_bps | float |
| net_sent_bps | float |

### `notification_config`
Singleton row (id = 1).

| Column | Type | Default |
|---|---|---|
| telegram_enabled | boolean | false |
| telegram_bot_token | varchar(256) nullable | |
| telegram_chat_id | varchar(128) nullable | |
| email_enabled | boolean | false |
| email_smtp_host | varchar(256) nullable | |
| email_smtp_port | integer | 25 |
| email_smtp_user | varchar(256) nullable | |
| email_smtp_password | varchar(256) nullable | |
| email_from | varchar(256) nullable | |
| email_to | varchar(256) nullable | |
| check_interval_minutes | integer | 5 |
| notify_on_failure | boolean | true |
| notify_on_recovery | boolean | true |

### `service_alert_states`
Tracks last known up/down state per service to avoid duplicate alerts.

| Column | Type |
|---|---|
| key | varchar(64) PK |
| is_down | boolean |
| alerted_at | timestamptz nullable |

---

## Background Tasks

Two asyncio tasks are started in the FastAPI lifespan:

### Metric Snapshot Task (`_metric_snapshot_loop`)
- Runs every **60 seconds**
- Calls `get_all_metrics()` (psutil, non-blocking)
- Writes one `MetricSnapshot` row to the database
- Powers the history charts on the Dashboard

### Notification Monitor Task (`_notification_monitor_loop`)
- Runs every **N minutes** (configured via `NotificationConfig.check_interval_minutes`, default 5)
- Loads `NotificationConfig` from DB; skips if none exists
- Checks each `MonitoredService` via TCP connect or Docker socket ping
- Compares result against `ServiceAlertState`
- Sends Telegram / email when a service transitions down → up or up → down
- Updates `ServiceAlertState` after each check

---

## Authentication Flow

```
POST /api/v1/auth/login
  → bcrypt verify password
  → issue access_token (JWT, 15 min) + refresh_token (JWT, 7 days)

Axios interceptor (client.ts):
  → attaches Bearer token to every request
  → on 401: calls POST /api/v1/auth/refresh, retries original request

WebSocket auth:
  → JWT passed as ?token= query parameter (headers not supported by browser WS API)
```

---

## Service Status Check Logic

| Service key | Check method |
|---|---|
| `docker` | Unix socket ping `GET /_ping` on `/var/run/docker.sock` |
| Any other | TCP `connect()` to configured `host:port` |

Status values: `active`, `inactive`, `failed`, `unknown`.

---

## Security Notes

- Email addresses are normalized to lowercase on write and lookup
- Container IDs validated against `[a-f0-9]{12,64}` before passing to aiodocker
- Service keys validated against `^[a-zA-Z0-9._@-]{1,64}$` before subprocess calls
- `subprocess` calls always use list form (`shell=False`)
- File paths resolved via `os.path.realpath()` (symlink-safe) — no injection possible
- Rate limiting on `/auth/login` and `/auth/setup` (slowapi, 5 req/min per IP)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options set in nginx config

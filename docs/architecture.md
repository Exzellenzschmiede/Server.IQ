# Architecture

## Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12, FastAPI, uvicorn |
| System monitoring | psutil (CPU / RAM / disk / network) |
| Process control | subprocess → systemctl / journalctl / ufw / crontab / apt / fail2ban-client |
| Docker management | aiodocker (async Docker SDK) |
| Authentication | JWT (python-jose), bcrypt (passlib) |
| Database ORM | SQLAlchemy 2 async + asyncpg |
| Database | PostgreSQL (host, not containerized) |
| WebSockets | FastAPI native WebSocket + asyncio PTY |
| Rate limiting | slowapi |
| HTTP client | httpx (Telegram notifications, weather API) |
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
│   │   ├── main.py              # FastAPI app, router registration, lifespan + background tasks
│   │   ├── config.py            # pydantic-settings (env vars)
│   │   ├── database.py          # SQLAlchemy async engine + session
│   │   ├── models.py            # All SQLAlchemy ORM models
│   │   ├── dependencies.py      # get_current_user, require_admin
│   │   ├── auth/                # JWT login, refresh, setup wizard
│   │   ├── system/              # Metrics, services, health, processes, history, ports, power
│   │   ├── docker_mgmt/         # Container CRUD + log streaming
│   │   ├── firewall/            # UFW read + write
│   │   ├── fail2ban/            # fail2ban-client status + unban
│   │   ├── ssl_certs/           # Let's Encrypt expiry checker + certbot renewal
│   │   ├── vhosts/              # nginx virtual host CRUD + SSL provisioning
│   │   ├── nginx_mgmt/          # nginx config read/write + reload/restart
│   │   ├── databases/           # PostgreSQL + MySQL connection manager + SQL runner
│   │   ├── backups/             # File-path and database backup creation + download
│   │   ├── email_mgmt/          # Postfix/Dovecot mailbox + alias + queue management
│   │   ├── updates/             # apt pending updates + upgrade
│   │   ├── cron/                # crontab read / write
│   │   ├── bandwidth/           # Historical network traffic from metric_snapshots
│   │   ├── access_log/          # nginx / Apache access log + SSH auth-log WebSocket
│   │   ├── network/             # Ping, DNS lookup, port check diagnostics
│   │   ├── files/               # Full filesystem browser + editor + upload
│   │   ├── cleanup/             # Disk scan + cleanup actions
│   │   ├── notifications/       # Telegram + SMTP config + background monitor + alert history
│   │   ├── settings/            # Monitored-service CRUD + app config (AI keys, upload limit)
│   │   ├── users/               # User management
│   │   ├── logs/                # App log streaming (journalctl WebSocket)
│   │   ├── console/             # PTY WebSocket terminal
│   │   ├── ai/                  # AI chat, log analysis, cron helper, agent mode
│   │   ├── audit/               # Admin action audit log
│   │   ├── ssh_keys/            # authorized_keys read/write
│   │   ├── weather/             # Current weather via Open-Meteo API
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
│   │   ├── pages/               # One file per page/route (33 pages total)
│   │   ├── components/
│   │   │   ├── layout/          # AppShell, Sidebar (desktop), BottomNav (mobile)
│   │   │   ├── ui/              # GaugeChart, MetricCard, StatusBadge, Spinner, Logo, Markdown
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
├── README.md                    # Project overview and quick start
├── docs/
│   ├── architecture.md          # This file
│   ├── api.md                   # All REST and WebSocket endpoints
│   ├── deployment.md            # Full deployment guide
│   └── user-guide.md            # Page-by-page user guide
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
Collected every 60 seconds by the background task. Also used for the Bandwidth page.

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

### `app_config`
Singleton row (id = 1). Managed via the Settings page.

| Column | Type | Default |
|---|---|---|
| id | integer PK | 1 |
| upload_max_size_mb | integer | 100 |
| ai_provider | varchar(32) nullable | |
| ai_model | varchar(128) nullable | |
| ai_api_key | varchar(512) nullable | |

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
| updated_at | timestamptz | |

### `service_alert_states`
Tracks last known up/down state per service to avoid duplicate alerts.

| Column | Type |
|---|---|
| key | varchar(64) PK |
| is_down | boolean |
| alerted_at | timestamptz nullable |

### `alert_history`
Persistent log of all sent alerts.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| recorded_at | timestamptz (indexed) | |
| channel | varchar(32) | `telegram` or `email` |
| service_key | varchar(64) | |
| event | varchar(16) | `down` or `recovery` |
| message | text | |

### `audit_logs`
Full admin action history.

| Column | Type |
|---|---|
| id | integer PK |
| recorded_at | timestamptz (indexed) |
| user_email | varchar(256) nullable |
| action | varchar(128) |
| resource | varchar(256) nullable |
| detail | text nullable |
| ip | varchar(64) nullable |

### `db_connections`
Database connection definitions for the Databases page.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | varchar(128) | display label |
| db_type | varchar(16) | `postgresql` or `mysql` |
| host | varchar(256) | |
| port | integer | |
| username | varchar(128) | |
| password | varchar(256) | |
| created_at | timestamptz | |

### `backups`
Backup job records.

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | varchar(256) | |
| created_at | timestamptz (indexed) | |
| completed_at | timestamptz nullable | |
| size_bytes | integer | |
| backup_path | varchar(512) | path to .tar.gz on disk |
| backup_type | varchar(16) | `files`, `database`, or `mixed` |
| status | varchar(16) | `running`, `done`, or `error` |
| error | text nullable | |
| include_paths | text | JSON array of paths |
| db_connection_id | integer nullable | FK to `db_connections` |
| db_name | varchar(256) nullable | |

---

## Middleware

| Middleware | Purpose |
|---|---|
| `AuditMiddleware` | Intercepts selected API routes and writes an `AuditLog` row |
| `UploadSizeLimitMiddleware` | Rejects file uploads exceeding the configured `upload_max_size_mb` |
| `CORSMiddleware` | Allows cross-origin requests from configured origins |

---

## Background Tasks

Two asyncio tasks are started in the FastAPI lifespan:

### Metric Snapshot Task (`_metric_snapshot_loop`)
- Runs every **60 seconds**
- Calls `get_all_metrics()` (psutil, non-blocking)
- Writes one `MetricSnapshot` row to the database
- Powers the Dashboard history charts and the Bandwidth page

### Notification Monitor Task (`_notification_monitor_loop`)
- Runs every **N minutes** (configured via `NotificationConfig.check_interval_minutes`, default 5)
- Loads `NotificationConfig` from DB; skips if none exists or both channels are disabled
- Checks each `MonitoredService` via TCP connect or Docker socket ping
- Compares result against `ServiceAlertState`
- Sends Telegram message / email when a service transitions down → up or up → down
- Writes an `AlertHistory` row for every sent alert
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
- `subprocess` calls always use list form (`shell=False`) — no shell injection possible
- File paths resolved via `os.path.realpath()` (symlink-safe)
- Database identifier names validated with `_is_valid_identifier()` before use in SQL
- Rate limiting on `/auth/login` and `/auth/setup` (slowapi, 5 req/min per IP)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options set in nginx config
- AI agent mode executes shell commands on the server — restricted to admin role

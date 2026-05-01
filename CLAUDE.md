# Server.IQ — CLAUDE.md

## Project Overview

Self-hosted VPS Admin Console as a Progressive Web App (PWA). Runs as a systemd service directly on the VPS host under the `root` user. Accessible at `https://server.exzellenzschmiede.de`. Provides real-time monitoring (CPU, RAM, disk, network, services) and full management of Docker containers, firewall rules, SSL certificates, cron jobs, files, and more.

---

## Workflow Rules

**Before every prompt: pull the latest state from the development branch.**

```bash
git pull origin claude/vps-admin-console-VW9pv
```

**After every completed prompt: commit and push to the development branch.**

```bash
git add -A
git commit -m "descriptive commit message"
git push -u origin claude/vps-admin-console-VW9pv
```

A push to `main` automatically triggers CI/CD deployment to the VPS.

**After every completed prompt: review `README.md` and all files in `docs/` and update any outdated or missing information before committing.**

---

## Infrastructure

| Parameter | Value |
|---|---|
| VPS IP | `217.154.199.218` |
| Domain | `server.exzellenzschmiede.de` |
| Backend port | `8100` |
| Frontend port | `8101` |
| PostgreSQL | host `localhost`, port `5432` |
| DB name | `server_iq` |
| DB user | `serveriq` |
| Service user | `root` |
| SSL | Let's Encrypt under `/etc/letsencrypt/live/server.exzellenzschmiede.de/` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12, FastAPI, uvicorn |
| System monitoring | psutil (CPU/RAM/disk/network), subprocess (systemctl/journalctl/ufw/crontab) |
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

## Project Structure

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
├── README.md                    # Project overview and quick start
├── docs/
│   ├── architecture.md          # Stack, module map, DB schema, background tasks
│   ├── api.md                   # All REST and WebSocket endpoints
│   ├── deployment.md            # Full deployment guide, env vars, sudoers, CI/CD
│   └── user-guide.md            # Page-by-page user guide
└── CLAUDE.md                    # This file
```

---

## API Endpoints (summary)

### Auth — `/api/v1/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/setup` | No | Check whether first-run setup is still needed |
| POST | `/auth/setup` | No | Create first admin user (locked after first user) |
| POST | `/auth/login` | No | Returns access_token (15 min) + refresh_token (7 d) |
| POST | `/auth/refresh` | No | Exchange refresh_token for new access_token |
| GET | `/auth/me` | JWT | Current user profile |

### System — `/api/v1/system`
| Method | Path | Description |
|---|---|---|
| GET | `/system/metrics` | CPU, RAM, disk, network snapshot (psutil) |
| GET | `/system/services` | Status of all enabled monitored services |
| GET | `/system/services/{key}/detail` | Parsed `systemctl show` output |
| GET | `/system/services/{key}/logs` | Last N lines from journalctl |
| POST | `/system/services/{key}/action` | start / stop / restart (admin) |
| GET | `/system/info` | Hostname, OS, kernel, uptime |
| GET | `/system/processes` | Top processes sorted by CPU or memory |
| GET | `/system/history` | Metric snapshots for last N hours |
| GET | `/system/health` | Disk / memory / load / apt-update health checks |

### Docker — `/api/v1/docker`
| Method | Path | Description |
|---|---|---|
| GET | `/docker/containers` | All containers (running + stopped) |
| GET | `/docker/containers/{id}` | Single container detail |
| POST | `/docker/containers/{id}/start\|stop\|restart` | Lifecycle control |
| DELETE | `/docker/containers/{id}` | Remove container (`?force=true`) |
| POST | `/docker/containers/{id}/reinstall` | Pull new image → recreate |
| GET | `/docker/images` | Local images list |
| GET | `/docker/containers/{id}/stats` | Live CPU% + memory |
| WS | `/docker/logs/{id}?token=JWT` | Live log stream |

### Other modules
- **`/api/v1/firewall`** — UFW status, enable/disable, add/delete rules (admin)
- **`/api/v1/ssl`** — Let's Encrypt certificate expiry list
- **`/api/v1/cron`** — Read, add, delete crontab entries (admin for write)
- **`/api/v1/files`** — Full filesystem browser + read/write (no path restrictions)
- **`/api/v1/notifications`** — Telegram + SMTP config + test send (admin)
- **`/api/v1/settings/services`** — Monitored-service CRUD (admin)
- **`/api/v1/users`** — User management (admin)
- **`WS /logs/stream`** — Live journalctl stream for the server-iq service itself
- **`WS /console`** — PTY bash shell via WebSocket

---

## Key Decisions & Notes

- **Bare-metal service**: Runs as a systemd service (`server-iq.service`) directly on the VPS host as `root` — no Docker involved at the application layer.
- **Service unit deployed on every CI/CD run**: `sudo cp server-iq.service /etc/systemd/system/ && sudo systemctl daemon-reload` ensures unit file changes take effect automatically.
- **Container ID validation**: All container IDs are validated against `[a-f0-9]{12,64}` before passing to aiodocker.
- **Service key validation**: Service keys validated against `^[a-zA-Z0-9._@-]{1,64}$` before subprocess calls.
- **WebSocket auth**: JWT cannot be sent in headers from the browser WS API → passed as `?token=` query parameter.
- **Token refresh**: Axios interceptor in `api/client.ts` catches 401 errors, refreshes automatically, and retries the original request.
- **First-run setup**: `App.tsx` calls `GET /auth/setup` on startup. If `setup_required: true`, redirects to `/setup`. The endpoint is locked after the first user is created (HTTP 409).
- **Email normalization**: Emails are stored and looked up in lowercase at all code paths (setup, login, create user, update user).
- **Monitored services**: Stored in the `monitored_services` DB table, managed via the Settings page. Default services seeded on first start: `nginx`, `postgresql`, `ssh`, `docker`.
- **Background tasks**: Two asyncio tasks started in FastAPI lifespan: metric snapshot collector (every 60 s) and notification monitor (configurable interval, default 5 min).
- **subprocess safety**: All subprocess calls use list form (`shell=False`). No user input passed to shell.
- **File browser**: No path restrictions — entire filesystem accessible. `os.path.realpath()` used for symlink normalization. Write endpoint requires admin role.
- **Health check thresholds**: ≥80% → Warning, ≥90% → Critical for disk and memory; load ≥ CPU count → Warning.
- **Network display**: Network throughput always shown in KB/s on the Dashboard (not auto-scaled).
- **Email (SMTP)**: For local Postfix — host `localhost`, port `25`, leave username and password empty.
- **`npm ci` in CI/CD**: Requires a committed `package-lock.json`. Always run `npm install` locally after adding frontend dependencies and commit the updated lockfile.

---

## CI/CD Pipeline (GitHub Actions)

**Trigger**: push to `main`

**Steps**:
1. Pre-flight check — abort if `/opt/server-iq` does not exist
2. `git pull` using ephemeral `GITHUB_TOKEN` as `GIT_TOKEN` env var
3. Backend — `pip install -r requirements.txt`, copy service unit, `daemon-reload`, `systemctl restart`
4. Frontend — `npm ci`, `npm run build`
5. nginx — copy config, symlink, `nginx -t && systemctl reload nginx`

**Required GitHub Secrets**:
| Secret | Value |
|---|---|
| `VPS_HOST` | `217.154.199.218` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private ED25519 key for root |

---

## Local Development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # adjust values
uvicorn app.main:app --reload --port 8100
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # proxies /api to localhost:8100
```

---

## Security Notes

- `.env` must **never** be committed to the repository (listed in `.gitignore`)
- Always generate `SECRET_KEY` with `openssl rand -hex 32`
- Rate limiting on login and setup: 5 requests/min per IP (slowapi)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options set in nginx config
- The service runs as `root` — required for systemctl, journalctl, ufw, crontab, and file write operations

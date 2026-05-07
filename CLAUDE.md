# Server.IQ — CLAUDE.md

> **MANDATORY INSTRUCTIONS FOR CLAUDE CODE**
> These rules are non-negotiable. Read them completely before doing anything else. Every single rule below MUST be followed on every prompt, without exception.

---

## MANDATORY CHECKLIST — Run Before Every Prompt

Before writing a single line of code or making any change, you MUST:

- [ ] Run `git pull origin main`
- [ ] Read and understand what already exists before adding anything new
- [ ] Confirm the task is scoped correctly — do not implement more than asked

After completing the task, you MUST:

- [ ] Review `README.md` and all files in `docs/` — update any section that is now outdated or incomplete
- [ ] Commit with a descriptive message and push to `main`

**Skipping any step in this checklist is not allowed.**

---

## Workflow Rules

### Git — MANDATORY on every prompt

```bash
# STEP 1 — Always do this first, before any work
git pull origin main

# STEP 2 — After completing the task
git add -A
git commit -m "type: concise description"
git push origin main
```

A push to `main` automatically triggers CI/CD deployment to the VPS. **Never skip the push.**

### Documentation — MANDATORY after every change

After every completed task you MUST review and update (if outdated):
- `README.md` — feature table, architecture overview
- `docs/architecture.md` — module map, DB schema, background tasks
- `docs/api.md` — API endpoint reference
- `docs/deployment.md` — infrastructure, env vars, CI/CD
- `docs/user-guide.md` — user-facing page descriptions

**If you add a new page, backend module, API endpoint, or DB table — update the docs before committing.**

### Language — STRICT

The **entire application must be in English**. This includes:
- All UI text, labels, button captions, tooltips, placeholder text
- Error messages and API response messages
- Log output and backend comments
- Documentation (README, docs/, CLAUDE.md)

**Do not write any German or other non-English text anywhere in the codebase, even accidentally.**

---

## Code Rules — STRICT

### General
- Do NOT add features, abstractions, or refactors beyond what was explicitly asked
- Do NOT add comments unless the WHY is non-obvious (no WHAT comments, no task references)
- Do NOT add error handling for scenarios that cannot happen
- Do NOT create new files unless strictly required — prefer editing existing ones
- Do NOT introduce backwards-compatibility shims or unused exports
- Do NOT add security vulnerabilities — validate user input at system boundaries, use parameterized queries

### Security (non-negotiable)
- `subprocess` calls MUST use list form (`shell=False`) — never pass user input to shell
- Container IDs MUST be validated against `[a-f0-9]{12,64}` before passing to aiodocker
- Service keys MUST be validated against `^[a-zA-Z0-9._@-]{1,64}$` before subprocess calls
- DB identifiers (database names, table names, usernames) MUST be validated with `_is_valid_identifier()` before use in SQL
- File paths MUST be resolved via `os.path.realpath()` before use
- `.env` must NEVER be committed to the repository

### Frontend
- After any frontend change: start the dev server, test the golden path, check for regressions
- All new pages MUST be added to `App.tsx` (router) and `Sidebar.tsx` (navigation)
- All new API calls MUST go through `frontend/src/api/` — never call axios directly from a page component
- After adding frontend dependencies: run `npm install` locally and commit the updated `package-lock.json` — CI/CD uses `npm ci`

### Backend
- New backend modules MUST be registered in `main.py`
- All write operations on files, firewall, cron, and SSH keys MUST require `require_admin`
- New DB tables MUST be added to `models.py` as SQLAlchemy ORM models
- New background tasks MUST be started in the FastAPI lifespan in `main.py`

---

## Infrastructure

| Parameter | Value |
|---|---|
| VPS IP | `your.vps.ip.address` |
| Domain | `your-domain.example.com` |
| Backend port | `8100` |
| Frontend port | `8101` |
| PostgreSQL | host `localhost`, port `5432` |
| DB name | `server_iq` |
| DB user | `serveriq` |
| Service user | `root` |
| SSL | Let's Encrypt under `/etc/letsencrypt/live/your-domain.example.com/` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12, FastAPI, uvicorn |
| System monitoring | psutil (CPU/RAM/disk/network), subprocess (systemctl/journalctl/ufw/crontab/apt/fail2ban-client) |
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
│   │   ├── access_log/          # nginx/Apache access log + SSH auth-log WebSocket
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
│   │   ├── pages/               # One file per page/route (33 pages)
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
├── .claude/
│   └── settings.local.json      # Claude Code project permissions
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

## Frontend Pages (33 total)

| Section | Pages |
|---|---|
| Overview | Dashboard, Health, Weather |
| Services & Containers | Services, Containers, ContainerLogs |
| Network & Security | Firewall, Fail2ban, Ports, SSL Certs |
| Hosting | Virtual Hosts, Databases, Backups, Email |
| System | Updates, Cron Jobs, Bandwidth, Access Log, Network, Files, Console, AI Assistant |
| Admin only | Notifications, Cleanup, Power, SSH Keys, Users, Audit Log, Settings, App Logs |
| Auth | Login, Setup |

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
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/system/metrics` | JWT | CPU, RAM, disk, network snapshot (psutil) |
| GET | `/system/services` | JWT | Status of all enabled monitored services |
| GET | `/system/services/{key}/detail` | JWT | Parsed `systemctl show` output |
| GET | `/system/services/{key}/logs` | JWT | Last N lines from journalctl |
| POST | `/system/services/{key}/action` | Admin | start / stop / restart |
| GET | `/system/info` | JWT | Hostname, OS, kernel, uptime |
| GET | `/system/processes` | JWT | Top processes sorted by CPU or memory |
| GET | `/system/history` | JWT | Metric snapshots for last N hours |
| GET | `/system/health` | JWT | Disk / memory / load / apt-update health checks |
| GET | `/system/ports` | JWT | Open TCP/UDP ports |
| POST | `/system/power` | Admin | reboot / shutdown |
| DELETE | `/system/processes/{pid}` | Admin | Kill process |
| POST | `/system/processes/{pid}/renice` | Admin | Renice process |

### Docker — `/api/v1/docker`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/docker/containers` | JWT | All containers (running + stopped) |
| GET | `/docker/containers/{id}` | JWT | Single container detail |
| POST | `/docker/containers/{id}/start\|stop\|restart` | JWT | Lifecycle control |
| DELETE | `/docker/containers/{id}` | JWT | Remove container |
| POST | `/docker/containers/{id}/reinstall` | JWT | Pull new image → recreate |
| GET | `/docker/images` | JWT | Local images list |
| GET | `/docker/containers/{id}/stats` | JWT | Live CPU% + memory |
| WS | `/docker/logs/{id}?token=JWT` | JWT | Live log stream |

### Hosting modules
| Prefix | Auth | Description |
|---|---|---|
| `/api/v1/vhosts` | Admin | nginx virtual host CRUD + SSL provisioning |
| `/api/v1/nginx` | Admin | nginx config read/write + reload/restart |
| `/api/v1/databases` | Admin | PostgreSQL + MySQL connection manager + SQL runner |
| `/api/v1/backups` | Admin | File-path and database backup creation + download |
| `/api/v1/email` | Admin | Postfix/Dovecot mailbox, alias, queue management |

### Other modules
| Prefix | Auth | Description |
|---|---|---|
| `/api/v1/firewall` | JWT/Admin | UFW status, enable/disable, add/delete rules |
| `/api/v1/fail2ban` | JWT/Admin | fail2ban status + unban IP |
| `/api/v1/ssl` | JWT/Admin | Certificate expiry list + per-domain renewal |
| `/api/v1/updates` | JWT/Admin | apt pending updates + upgrade |
| `/api/v1/cron` | JWT/Admin | Read, add, delete crontab entries |
| `/api/v1/bandwidth` | JWT | Historical network traffic (from metric_snapshots) |
| `/api/v1/access-log` | JWT | nginx/Apache access log + SSH auth-log WS |
| `/api/v1/network` | JWT | Ping, DNS lookup, port check from the server |
| `/api/v1/files` | JWT/Admin | Full filesystem browser + read/write/upload |
| `/api/v1/cleanup` | Admin | Disk scan + cleanup actions |
| `/api/v1/notifications` | Admin | Telegram + SMTP config + test send + alert history |
| `/api/v1/settings` | Admin | Monitored-service CRUD + app config |
| `/api/v1/users` | Admin | User management |
| `/api/v1/ai` | JWT/Admin | Chat, log analysis, cron helper, agent mode |
| `/api/v1/audit` | Admin | Admin action audit log |
| `/api/v1/ssh-keys` | JWT/Admin | authorized_keys read/write |
| `/api/v1/weather` | JWT | Current weather via Open-Meteo |
| `WS /logs/stream` | JWT | Live journalctl stream for server-iq service |
| `WS /console` | JWT | PTY bash shell via WebSocket |

---

## Database Tables (all in `models.py`)

| Table | Purpose |
|---|---|
| `users` | User accounts (id, name, email, password_hash, role, is_active) |
| `monitored_services` | Services tracked on the Services page + by the notification monitor |
| `metric_snapshots` | System metrics collected every 60 s (powers Dashboard history + Bandwidth) |
| `app_config` | Singleton: AI provider/model/key, upload size limit |
| `notification_config` | Singleton: Telegram + SMTP settings, check interval, notify flags |
| `service_alert_states` | Last known up/down state per service (deduplication) |
| `alert_history` | Log of all sent alerts (channel, service, event, message) |
| `audit_logs` | Admin action history (user, action, resource, detail, IP) |
| `db_connections` | Saved database connection profiles (type, host, port, credentials) |
| `backups` | Backup job records (name, type, status, path, size) |

---

## Key Decisions & Non-Obvious Behaviors

- **Bare-metal service**: Runs as a systemd service (`server-iq.service`) directly on the VPS host as `root` — no Docker involved at the application layer.
- **Service unit deployed on every CI/CD run**: `sudo cp server-iq.service /etc/systemd/system/ && sudo systemctl daemon-reload` ensures unit file changes take effect automatically.
- **WebSocket auth**: JWT cannot be sent in headers from the browser WS API → always passed as `?token=` query parameter.
- **Token refresh**: Axios interceptor in `api/client.ts` catches 401 errors, calls `POST /auth/refresh`, and retries the original request automatically.
- **First-run setup**: `App.tsx` calls `GET /auth/setup` on startup. If `setup_required: true`, redirects to `/setup`. Endpoint locked after the first user is created (HTTP 409).
- **Email normalization**: Emails are stored and looked up in lowercase at all code paths (setup, login, create user, update user).
- **Monitored services**: Stored in `monitored_services` DB table, managed via Settings page. Default services seeded on first start: `nginx`, `postgresql`, `ssh`, `docker`.
- **Background tasks**: Two asyncio tasks in FastAPI lifespan — metric snapshot collector (every 60 s) and notification monitor (configurable interval, default 5 min).
- **subprocess safety**: All subprocess calls use list form (`shell=False`). No user input ever passed to shell.
- **File browser**: No path restrictions — entire filesystem accessible. `os.path.realpath()` used for symlink normalization. Write/delete/upload requires admin role.
- **Health check thresholds**: ≥ 80 % → Warning, ≥ 90 % → Critical for disk and memory; load ≥ CPU count → Warning.
- **Network throughput**: Always shown in KB/s on the Dashboard (not auto-scaled).
- **Email (SMTP)**: For local Postfix — host `localhost`, port `25`, leave username and password empty.
- **`npm ci` in CI/CD**: Requires a committed `package-lock.json`. Always run `npm install` locally after adding frontend dependencies and commit the updated lockfile.
- **Bandwidth page**: Reads from `metric_snapshots` table — requires data to be collected by the background task (starts accumulating after first startup).
- **AI agent mode**: Admin-only. Executes shell commands on the server. Uses `subprocess` with list form.
- **Markdown rendering**: AI assistant chat renders markdown including tables and code blocks (via `Markdown` component in `components/ui/`).
- **DB identifier validation**: `databases/service.py` has `_is_valid_identifier()` — used before any database/table/user name is passed to raw SQL.

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
| `VPS_HOST` | `your.vps.ip.address` |
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

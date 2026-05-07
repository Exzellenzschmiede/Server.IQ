```
 ╔═════════════════════════════════════════════════════════════╗
 ║                                                             ║
 ║   ░██████╗███████╗██████╗ ██╗   ██╗███████╗██████╗          ║
 ║   ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗         ║
 ║   ╚█████╗ █████╗  ██████╔╝██║   ██║█████╗  ██████╔╝         ║
 ║    ╚═══██╗██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗         ║
 ║   ██████╔╝███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║         ║
 ║   ╚═════╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ .IQ     ║
 ║   ★  ★  ★   Know your server. Own your server.   ★  ★  ★    ║
 ║                                                             ║
 ╚═════════════════════════════════════════════════════════════╝
```

A self-hosted VPS admin console — Progressive Web App (PWA) you deploy once on your server and access from any device.

---

<img width="1409" height="664" alt="image" src="https://github.com/user-attachments/assets/f012b471-417a-4cd9-9948-390dce937af7" />

---

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Real-time CPU / RAM / Disk / Network gauges, Load Average, Disk I/O, TCP connections, Top-5 processes, service status grid, historical line charts (1 h / 2 h / 6 h / 24 h) |
| **Health Check** | Per-partition disk, RAM, CPU load and apt-update checks with OK / Warning / Critical classification |
| **Weather** | Current weather and forecast for the server's location via Open-Meteo |
| **Services** | systemd service status, start / stop / restart, expandable detail panel (PID, memory, CPU time, active since), live journal log viewer |
| **Docker** | List all containers (running + stopped), start / stop / restart / delete / reinstall, live log stream via WebSocket, live CPU % + memory stats |
| **Firewall** | UFW status, enable / disable, add / delete rules |
| **Fail2ban** | Overview of active jails and banned IPs, one-click unban |
| **Ports** | List of all open TCP / UDP ports with associated process names |
| **SSL Certs** | Let's Encrypt certificate expiry overview with color-coded warnings, one-click renewal via certbot |
| **Virtual Hosts** | Create / enable / disable / delete nginx virtual hosts; edit raw vhost config; request Let's Encrypt SSL per domain |
| **Databases** | Manage PostgreSQL and MySQL connections; create / drop databases, users and tables; grant privileges; run ad-hoc SQL queries |
| **Backups** | Create file-path and database backups, track status (running / done / error), download archives |
| **Email** | Manage Postfix / Dovecot mailboxes and aliases; inspect and flush the mail queue |
| **Updates** | List pending apt packages, run `apt update`, apply upgrades |
| **Cron Jobs** | View, add and delete crontab entries; AI-powered cron expression helper |
| **Bandwidth** | Historical inbound / outbound traffic chart (up to 90 days) |
| **Access Log** | nginx / Apache access log viewer + live SSH auth-log stream |
| **Network** | Ping, DNS lookup, TCP port-check diagnostics; live network interface stats |
| **File Browser** | Full filesystem navigation (no path restrictions), hidden files, inline text editor, upload, copy, delete |
| **Console** | Full PTY terminal (xterm.js) via WebSocket — works exactly like SSH |
| **AI Assistant** | Multi-provider AI chat with live server context, log analysis, cron helper, agent mode (shell command execution) |
| **Notifications** | Telegram Bot + SMTP alerts for service failures and recoveries, configurable check interval, alert history |
| **Cleanup** | Scan disk for large files and Docker artifacts; run targeted cleanup actions |
| **Power** | Reboot or shut down the server with a confirmation step |
| **SSH Keys** | View, add and delete entries in `~/.ssh/authorized_keys` |
| **Users** | User management (admin only) — create, edit, reset password, assign roles |
| **Audit Log** | Full action history: who did what, when, from which IP |
| **Settings** | Configure monitored services; set AI provider / model / API key; configure upload size limits |
| **App Logs** | Live journalctl stream for the server-iq service itself |
| **PWA** | Installable on iOS / Android / Desktop, dark theme, responsive layout |

---

## Architecture in one line

```
nginx (TLS) → uvicorn (FastAPI, port 8100) + static files (built React, port 8101)
                        ↕ SQLAlchemy / asyncpg
                  PostgreSQL (host, port 5432)
```

The backend runs directly on the host as a systemd service (`server-iq.service`) under the `root` user. No Docker involved at the application layer.

---

## Quick Start (first deployment)

### Prerequisites on the VPS

- Ubuntu 22.04 / 24.04
- Python 3.12+
- Node.js 20+ LTS
- PostgreSQL running locally
- nginx installed

### 1 — Clone and run setup

```bash
git clone https://github.com/your-org/server-iq /opt/server-iq
cd /opt/server-iq
sudo bash setup.sh
```

`setup.sh` creates the Python venv, builds the frontend, installs the systemd unit, configures nginx and writes the sudoers file.

### 2 — Edit environment

```bash
nano /opt/server-iq/.env
```

Minimum required:

```env
SECRET_KEY=<openssl rand -hex 32>
POSTGRES_USER=serveriq
POSTGRES_PASSWORD=your_password
POSTGRES_DB=server_iq
CORS_ORIGINS=["https://your-domain.example.com"]
```

### 3 — Create the database

```bash
sudo -u postgres psql -c "CREATE USER serveriq WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE server_iq OWNER serveriq;"
```

### 4 — Start

```bash
sudo systemctl start server-iq
sudo systemctl reload nginx
```

### 5 — First login

Visit `https://your-domain.example.com` — you will be redirected to the **Setup page** to create the first admin account.

---

## CI/CD (GitHub Actions)

Push to `main` triggers `.github/workflows/deploy.yml`:

1. SSH into VPS
2. `git pull origin main`
3. `pip install -r requirements.txt`
4. Copy `server-iq.service` → `systemctl daemon-reload && systemctl restart server-iq`
5. `npm ci && npm run build`
6. Deploy nginx config and reload

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `VPS_HOST` | `your.vps.ip.address` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private ED25519 key for root |

---

## Documentation

| Document | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Stack, module map, database schema, background tasks |
| [docs/api.md](docs/api.md) | All REST and WebSocket endpoints |
| [docs/deployment.md](docs/deployment.md) | Full deployment guide, environment variables, sudoers |
| [docs/user-guide.md](docs/user-guide.md) | How to use each page of the application |

---

## Local Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # adjust values
uvicorn app.main:app --reload --port 8100

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api to localhost:8100
```

---

## License

**MIT License** — Copyright (c) 2026 Exzellenzschmiede

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

See [`LICENSE`](LICENSE) for the full license text.

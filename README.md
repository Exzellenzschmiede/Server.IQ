  ░██████╗███████╗██████╗ ██╗   ██╗███████╗██████╗    
  ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗   
  ╚█████╗ █████╗  ██████╔╝██║   ██║█████╗  ██████╔╝   
   ╚═══██╗██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗   
  ██████╔╝███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║   
  ╚═════╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ .IQ  
  ★  ★  ★   Know your server. Own your server.   ★  ★  ★     
  

A self-hosted VPS admin console — Progressive Web App (PWA) you deploy once on your server and access from any device.

**Live demo:** `https://server.exzellenzschmiede.de`

---

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Real-time CPU / RAM / Disk / Network gauges, Load Average, Disk I/O, TCP connections, Top-5 processes, service status grid, historical line charts (Recharts) |
| **Health Check** | Disk, memory, load average and apt-update checks with OK / Warning / Critical classification |
| **Services** | systemd service status, start / stop / restart, expandable detail panel (PID, memory, CPU time, active since), live journal log viewer |
| **Docker** | List all containers (running + stopped), start / stop / restart / delete / reinstall, live log stream via WebSocket, resource stats |
| **Firewall** | UFW status, enable / disable, add / delete rules |
| **SSL Certs** | Let's Encrypt certificate expiry overview with color-coded warnings |
| **Cron Jobs** | View, add and delete crontab entries for the service user |
| **File Browser** | Full filesystem navigation (all paths), hidden files shown, inline text editor with save |
| **Console** | PTY terminal (xterm.js) via WebSocket |
| **App Logs** | Live journalctl stream for the server-iq service itself |
| **Notifications** | Telegram Bot + SMTP (Postfix-ready) alerts for service failures and recoveries |
| **Users** | User management (admin-only), password reset, role assignment |
| **Settings** | Configure which systemd services are monitored |
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
git clone https://github.com/exzellenzschmiede/server.iq /opt/server-iq
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
| `VPS_HOST` | `217.154.199.218` |
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

MIT

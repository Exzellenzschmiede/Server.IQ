# Deployment Guide

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
| SSL | Let's Encrypt under `/etc/letsencrypt/live/` |

---

## First-Time Setup

`setup.sh` must be run **once** on the VPS as root before CI/CD will work.

```bash
git clone https://github.com/exzellenzschmiede/server.iq /opt/server-iq
cd /opt/server-iq
sudo bash setup.sh
```

What it does:
1. Creates Python venv and installs dependencies
2. Builds the React frontend (`npm ci && npm run build`)
3. Copies `.env.example` → `.env` (you must edit this)
4. Installs `server-iq.service` to `/etc/systemd/system/` and enables it
5. Deploys `nginx/server-iq.conf` to `/etc/nginx/sites-available/` and symlinks it
6. Writes `/etc/sudoers.d/server-iq` with the required NOPASSWD rules

After setup:
```bash
nano /opt/server-iq/.env          # fill in secrets
sudo systemctl start server-iq
sudo systemctl reload nginx
```

---

## Environment Variables

File: `/opt/server-iq/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | ✓ | — | JWT signing key. Generate: `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | `7` | Refresh token lifetime |
| `POSTGRES_HOST` | | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | | `5432` | PostgreSQL port |
| `POSTGRES_DB` | ✓ | — | Database name |
| `POSTGRES_USER` | ✓ | — | Database user |
| `POSTGRES_PASSWORD` | ✓ | — | Database password |
| `CORS_ORIGINS` | | `["http://localhost:5173"]` | JSON list of allowed origins |

---

## systemd Service

File: `/opt/server-iq/server-iq.service`

```ini
[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/server-iq/backend
EnvironmentFile=/opt/server-iq/.env
ExecStart=/opt/server-iq/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100
Restart=always
RestartSec=5
```

The service file is **deployed on every CI/CD run** (`sudo cp ... && sudo systemctl daemon-reload`), so changes in git take effect automatically.

Useful commands:
```bash
sudo systemctl status server-iq
sudo systemctl restart server-iq
journalctl -u server-iq -f          # live logs
journalctl -u server-iq -n 200      # last 200 lines
```

---

## nginx Configuration

File: `nginx/server-iq.conf` (deployed to `/etc/nginx/sites-available/server-iq.conf`)

```nginx
server {
    listen 443 ssl;
    server_name server.exzellenzschmiede.de;

    ssl_certificate     /etc/letsencrypt/live/server.exzellenzschmiede.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/server.exzellenzschmiede.de/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location /api/ {
        proxy_pass http://127.0.0.1:8100/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # WebSocket support
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:8101/;
    }
}

server {
    listen 80;
    server_name server.exzellenzschmiede.de;
    return 301 https://$host$request_uri;
}
```

---

## sudoers

File: `/etc/sudoers.d/server-iq` (written by `setup.sh`)

Grants the service user passwordless access to:
- `systemctl start/stop/restart/reload *`
- `systemctl daemon-reload`
- `ufw status numbered`, `ufw --force enable/disable`, `ufw allow/deny/reject/limit/delete *`
- `cp server-iq.service` and nginx config
- `ln -sf` nginx symlink
- `nginx -t`

> **Note:** Since the service now runs as `root`, these rules are no longer strictly required for the service itself but are kept for CI/CD deployments running as a non-root deploy user if the service user is ever changed back.

---

## CI/CD Pipeline

File: `.github/workflows/deploy.yml`

Trigger: push to `main`

### GitHub Secrets

| Secret | Description |
|---|---|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH login user (currently `root`) |
| `VPS_SSH_KEY` | Private ED25519 SSH key |

### Pipeline Steps

1. **Pre-flight check** — abort if `/opt/server-iq` does not exist (setup.sh not run yet)
2. **git pull** — uses ephemeral `GITHUB_TOKEN` passed as `GIT_TOKEN` env var for private repo access
3. **Backend** — `pip install -r requirements.txt`, copy service unit, `daemon-reload`, `systemctl restart`
4. **Frontend** — `npm ci`, `npm run build`
5. **nginx** — copy config, symlink, `nginx -t && systemctl reload nginx`

### Enabling Root SSH Login (required when `VPS_USER=root`)

```bash
# On the VPS:
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo systemctl reload ssh
sudo mkdir -p /root/.ssh
sudo cp /home/deploy/.ssh/authorized_keys /root/.ssh/authorized_keys
sudo chmod 700 /root/.ssh && sudo chmod 600 /root/.ssh/authorized_keys
```

---

## Database Operations

```bash
# Connect
sudo -u postgres psql server_iq

# Normalize existing email addresses to lowercase
UPDATE users SET email = lower(email) WHERE email != lower(email);

# Check monitored services
SELECT key, display_name, host, port, enabled FROM monitored_services;

# View recent metric snapshots
SELECT recorded_at, cpu_percent, memory_percent FROM metric_snapshots ORDER BY recorded_at DESC LIMIT 10;
```

---

## Updating the sudoers After setup.sh Changes

```bash
sudo cp /opt/server-iq/setup.sh /tmp/  # inspect first
sudo bash -c "cat > /etc/sudoers.d/server-iq << 'EOF'
...
EOF"
sudo chmod 440 /etc/sudoers.d/server-iq
```

Or simply re-run the sudoers section from `setup.sh` manually.

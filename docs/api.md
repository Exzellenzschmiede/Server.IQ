# API Reference

Base URL: `https://your-domain/api/v1`

All endpoints except `/auth/setup`, `/auth/login`, `/auth/refresh` require a valid JWT in the `Authorization: Bearer <token>` header. Admin-only endpoints additionally require `role = admin`.

---

## Auth — `/auth`

### `GET /auth/setup`
Returns whether the first-run setup is still required (no users in DB).

**Response**
```json
{ "setup_required": true }
```

### `POST /auth/setup`
Creates the first admin user. Returns 409 if any user already exists.

**Body**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "..." }
```

**Response** → `TokenResponse`

### `POST /auth/login`
**Body**
```json
{ "email": "alice@example.com", "password": "..." }
```
Email matching is case-insensitive.

**Response**
```json
{ "access_token": "...", "refresh_token": "..." }
```

### `POST /auth/refresh`
**Body**
```json
{ "refresh_token": "..." }
```

### `GET /auth/me` *(auth required)*
Returns the current user's profile.

---

## System — `/system`

### `GET /system/metrics` *(auth)*
Snapshot of all system metrics.

**Response schema: `SystemMetrics`**
```json
{
  "cpu": { "percent": 12.3, "per_core": [...], "count": 4, "count_logical": 8, "frequency_mhz": 2400 },
  "memory": { "total_bytes": ..., "available_bytes": ..., "used_bytes": ..., "percent": 45.2 },
  "disk": [{ "mountpoint": "/", "total_bytes": ..., "used_bytes": ..., "free_bytes": ..., "percent": 38.1, "fstype": "ext4" }],
  "network": [{ "name": "eth0", "bytes_sent": ..., "bytes_recv": ..., "bytes_sent_per_sec": ..., "bytes_recv_per_sec": ... }],
  "disk_io": { "read_bytes_per_sec": ..., "write_bytes_per_sec": ... },
  "load_avg": { "load_1": 0.42, "load_5": 0.38, "load_15": 0.31 },
  "tcp_connections": 47,
  "timestamp": 1714500000.0
}
```

### `GET /system/info` *(auth)*
Hostname, OS, kernel version, uptime.

### `GET /system/services` *(auth)*
Status of all enabled monitored services.

**Response**
```json
{ "services": [{ "name": "nginx", "display_name": "NGINX", "status": "active" }] }
```

### `GET /system/services/{key}/detail` *(auth)*
Parsed `systemctl show` output.

**Response schema: `ServiceDetail`**
```json
{
  "key": "nginx",
  "description": "A high performance web server",
  "active_state": "active",
  "sub_state": "running",
  "load_state": "loaded",
  "unit_file_state": "enabled",
  "main_pid": 12345,
  "active_since": "Thu 2025-01-01 10:00:00 UTC",
  "memory_bytes": 15728640,
  "cpu_usage_ms": 4200,
  "fragment_path": "/lib/systemd/system/nginx.service"
}
```

### `GET /system/services/{key}/logs?lines=100` *(auth)*
Last N lines from `journalctl -u <key>`. Max 500 lines.

### `POST /system/services/{key}/action` *(admin)*
**Body**
```json
{ "action": "start" }   // "start" | "stop" | "restart"
```

### `GET /system/processes?sort_by=cpu&limit=10` *(auth)*
Top processes sorted by `cpu` or `memory`.

### `GET /system/history?hours=2` *(auth)*
Metric snapshots from the last N hours (max 168). Powered by the background collector.

### `GET /system/health` *(auth)*
Disk, memory, load average and apt-update health checks.

**Response**
```json
{
  "overall": "warning",
  "updates_available": 12,
  "checks": [
    { "name": "Disk /", "status": "ok", "value": "38.1%", "detail": "120.5 GB free of 200.0 GB" },
    { "name": "Arbeitsspeicher", "status": "warning", "value": "82.3%", "detail": "6.6 GB / 8.0 GB" },
    { "name": "CPU Load (1 min)", "status": "ok", "value": "0.42", "detail": "4 CPU cores" },
    { "name": "System-Updates", "status": "warning", "value": "12 ausstehend", "detail": "apt upgradable packages" }
  ]
}
```

---

## Docker — `/docker`

### `GET /docker/containers` *(auth)*
All containers (running and stopped).

### `GET /docker/containers/{id}` *(auth)*
Single container detail including volumes, networks, restart policy.

### `POST /docker/containers/{id}/start` *(auth)*
### `POST /docker/containers/{id}/stop` *(auth)*
### `POST /docker/containers/{id}/restart` *(auth)*
### `DELETE /docker/containers/{id}?force=false` *(auth)*
### `POST /docker/containers/{id}/reinstall` *(auth)*
Pulls new image → removes old container → recreates with same config.

### `GET /docker/images` *(auth)*
Local images list.

### `GET /docker/containers/{id}/stats` *(auth)*
Live CPU% and memory for a running container.

### `WS /docker/logs/{id}?token=<jwt>` *(auth via query param)*
Live log stream.

---

## Firewall — `/firewall`

### `GET /firewall` *(auth)*
UFW status and rule list.

### `POST /firewall/enable` *(admin)*
### `POST /firewall/disable` *(admin)*
### `POST /firewall/rules` *(admin)*
**Body**
```json
{ "port": "8080", "protocol": "tcp", "action": "allow" }
```
`protocol`: `tcp` | `udp` | `any` — `action`: `allow` | `deny` | `reject`

### `DELETE /firewall/rules/{num}` *(admin)*
Deletes rule by its UFW rule number.

---

## SSL Certificates — `/ssl`

### `GET /ssl` *(auth)*
Reads all certificates from `/etc/letsencrypt/live/` via `openssl x509`.

**Response**
```json
[{ "domain": "example.com", "not_before": "...", "not_after": "...", "days_remaining": 72, "expired": false }]
```

---

## Cron Jobs — `/cron`

### `GET /cron` *(auth)*
Current crontab of the service user.

### `POST /cron` *(admin)*
**Body**
```json
{ "schedule": "0 2 * * *", "command": "/opt/backup.sh >> /var/log/backup.log 2>&1" }
```

### `DELETE /cron/{index}` *(admin)*
Deletes job by its index in the crontab.

---

## File Browser — `/files`

### `GET /files?path=/var/log` *(auth)*
Directory listing. No path restriction — entire filesystem accessible.

### `GET /files/read?path=/etc/nginx/nginx.conf` *(auth)*
Read file content (max 2 MB). Returns 415 for binary files.

### `POST /files/write` *(admin)*
**Body**
```json
{ "path": "/etc/nginx/nginx.conf", "content": "..." }
```

---

## Notifications — `/notifications`

### `GET /notifications` *(admin)*
### `PATCH /notifications` *(admin)*
Partial update — only send fields you want to change.

### `POST /notifications/test` *(admin)*
**Body**
```json
{ "channel": "telegram" }   // "telegram" | "email"
```

---

## Settings — `/settings`

### `GET /settings/services` *(admin)*
### `POST /settings/services` *(admin)*
### `PUT /settings/services/{id}` *(admin)*
### `DELETE /settings/services/{id}` *(admin)*

---

## Users — `/users`

### `GET /users` *(admin)*
### `POST /users` *(admin)*
### `GET /users/{id}` *(auth — admin or own profile)*
### `PUT /users/{id}` *(admin)*
### `DELETE /users/{id}` *(admin)*
### `POST /users/{id}/reset-password` *(admin)*
### `GET /users/generate-password` *(admin)*

---

## WebSockets

### `WS /logs/stream?token=<jwt>&lines=300`
Live `journalctl -u server-iq -f` stream for the application itself.

### `WS /console?token=<jwt>`
PTY shell (bash) via WebSocket. xterm.js on the frontend.

### `WS /docker/logs/{id}?token=<jwt>`
Live Docker container log stream.

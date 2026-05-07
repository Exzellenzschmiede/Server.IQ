# API Reference

Base URL: `https://your-domain/api/v1`

All endpoints except `/auth/setup`, `/auth/login`, and `/auth/refresh` require a valid JWT in the `Authorization: Bearer <token>` header. Admin-only endpoints additionally require `role = admin`.

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

### `GET /auth/me` *(auth)*
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

### `GET /system/services/{key}/logs?lines=100` *(auth)*
Last N lines from `journalctl -u <key>`. Max 500 lines.

### `POST /system/services/{key}/action` *(admin)*
**Body**
```json
{ "action": "start" }   // "start" | "stop" | "restart"
```

### `GET /system/processes?sort_by=cpu&limit=10` *(auth)*
Top processes sorted by `cpu` or `memory`.

### `DELETE /system/processes/{pid}` *(admin)*
Kill a process by PID.

### `POST /system/processes/{pid}/renice` *(admin)*
Change the niceness of a process.

### `GET /system/history?hours=2` *(auth)*
Metric snapshots from the last N hours (max 168).

### `GET /system/health` *(auth)*
Disk, memory, load average and apt-update health checks.

**Response**
```json
{
  "overall": "warning",
  "updates_available": 12,
  "checks": [
    { "name": "Disk /", "status": "ok", "value": "38.1%", "detail": "120.5 GB free of 200.0 GB" },
    { "name": "Memory", "status": "warning", "value": "82.3%", "detail": "6.6 GB / 8.0 GB" },
    { "name": "CPU Load (1 min)", "status": "ok", "value": "0.42", "detail": "4 CPU cores" },
    { "name": "System Updates", "status": "warning", "value": "12 pending", "detail": "apt upgradable packages" }
  ]
}
```

### `GET /system/ports` *(auth)*
List of all open TCP and UDP ports with associated process names (parsed from `ss` / `netstat`).

### `POST /system/power` *(admin)*
Reboot or shut down the server.

**Body**
```json
{ "action": "reboot" }   // "reboot" | "shutdown"
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

## Fail2ban — `/fail2ban`

### `GET /fail2ban` *(auth)*
Status of all fail2ban jails: active jails, total banned IPs, and per-jail banned IP list.

### `POST /fail2ban/unban` *(admin)*
**Body**
```json
{ "jail": "sshd", "ip": "1.2.3.4" }
```

---

## SSL Certificates — `/ssl`

### `GET /ssl` *(auth)*
Reads all certificates from `/etc/letsencrypt/live/` via `openssl x509`.

**Response**
```json
[{ "domain": "example.com", "not_before": "...", "not_after": "...", "days_remaining": 72, "expired": false }]
```

### `POST /ssl/{domain}/renew` *(admin)*
Runs `certbot renew --cert-name <domain> --non-interactive`. Timeout: 120 s.

**Response**
```json
{ "domain": "example.com", "success": true, "output": "...certbot stdout/stderr..." }
```

---

## Virtual Hosts — `/vhosts`

All endpoints require admin role.

### `GET /vhosts`
List all nginx virtual hosts (reads `/etc/nginx/sites-available/`).

### `POST /vhosts`
Create a new virtual host.

**Body**
```json
{
  "domain": "shop.example.com",
  "root_path": "/var/www/shop",
  "vhost_type": "static",
  "php_version": null,
  "proxy_pass": null
}
```
`vhost_type`: `static` | `php` | `proxy`

### `DELETE /vhosts/{domain}`
Delete the virtual host config and disable it in nginx.

### `PATCH /vhosts/{domain}/toggle?enabled=true`
Enable or disable the site (`sites-enabled` symlink).

### `GET /vhosts/{domain}/config`
Read raw nginx config file for this domain.

### `PUT /vhosts/{domain}/config`
Write raw nginx config.

**Body**
```json
{ "config": "server { ... }" }
```

### `POST /vhosts/{domain}/ssl`
Request a Let's Encrypt certificate for the domain via certbot.

**Response**
```json
{ "success": true, "output": "...certbot output..." }
```

---

## NGINX Management — `/nginx`

All endpoints require admin role.

### `GET /nginx/status`
NGINX running status and version.

### `GET /nginx/sites`
List of all sites with enabled/available status.

### `GET /nginx/config?name={name}`
Read a site config file.

### `PUT /nginx/config`
Write a site config file.

### `DELETE /nginx/config?name={name}`
Delete a config file.

### `POST /nginx/sites/{name}/enable`
Enable a site (create symlink in `sites-enabled`).

### `POST /nginx/sites/{name}/disable`
Disable a site (remove symlink).

### `POST /nginx/test`
Run `nginx -t` and return the result.

### `POST /nginx/reload`
Reload nginx config (`systemctl reload nginx`).

### `POST /nginx/restart`
Restart nginx (`systemctl restart nginx`).

---

## Databases — `/databases`

All endpoints require admin role.

### `GET /databases/connections`
List all saved database connections.

### `POST /databases/connections`
Save a new database connection.

**Body**
```json
{ "name": "Local PG", "db_type": "postgresql", "host": "127.0.0.1", "port": 5432, "username": "serveriq", "password": "..." }
```
`db_type`: `postgresql` | `mysql`

### `DELETE /databases/connections/{conn_id}`
Delete a saved connection.

### `GET /databases/{conn_id}/databases`
List databases on the server.

### `POST /databases/{conn_id}/databases`
Create a database.

**Body** `{ "name": "myapp" }`

### `DELETE /databases/{conn_id}/databases/{name}`
Drop a database.

### `GET /databases/{conn_id}/databases/{name}/tables`
List tables in a database.

### `GET /databases/{conn_id}/users` *(PostgreSQL only)*
List database users / roles.

### `POST /databases/{conn_id}/users` *(PostgreSQL only)*
Create a database user.

**Body** `{ "username": "myuser", "password": "..." }`

### `DELETE /databases/{conn_id}/users/{username}` *(PostgreSQL only)*
Drop a user.

### `POST /databases/{conn_id}/grant` *(PostgreSQL only)*
Grant privileges on a database to a user.

**Body** `{ "database": "myapp", "username": "myuser", "privilege": "ALL" }`

### `POST /databases/{conn_id}/query`
Execute a SQL query and return results.

**Body** `{ "database": "myapp", "sql": "SELECT * FROM users LIMIT 10" }`

---

## Backups — `/backups`

All endpoints require admin role.

### `GET /backups`
List all backup records with status (running / done / error).

### `POST /backups`
Start a new backup (asynchronous).

**Body**
```json
{
  "name": "weekly-backup",
  "include_paths": ["/var/www", "/etc/nginx"],
  "db_connection_id": 1,
  "db_name": "myapp"
}
```
`db_connection_id` and `db_name` are optional. Omit both for a files-only backup.

### `DELETE /backups/{backup_id}`
Delete a backup record and its archive from disk.

### `GET /backups/{backup_id}/download`
Download the backup archive as a `.tar.gz` file.

---

## Email — `/email`

All endpoints require admin role.

### `GET /email/status`
Mail server (Postfix + Dovecot) status.

### `GET /email/mailboxes`
List all mailboxes.

### `POST /email/mailboxes`
Create a mailbox.

**Body** `{ "email": "user@example.com", "password": "..." }`

### `DELETE /email/mailboxes/{email}`
Delete a mailbox.

### `GET /email/aliases`
List all aliases.

### `POST /email/aliases`
Create an alias.

**Body** `{ "source": "info@example.com", "destination": "user@example.com" }`

### `DELETE /email/aliases/{source}`
Delete an alias.

### `GET /email/queue`
List items in the mail queue.

### `POST /email/queue/flush`
Flush the entire mail queue (`postqueue -f`).

### `DELETE /email/queue/{queue_id}`
Delete a specific item from the queue.

---

## Updates — `/updates`

### `GET /updates` *(auth)*
List pending apt packages.

### `POST /updates/fetch` *(admin)*
Run `apt update` to refresh the package index.

### `POST /updates/upgrade` *(admin)*
Apply available upgrades (`apt upgrade -y`).

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

## Bandwidth — `/bandwidth`

### `GET /bandwidth?days=30` *(auth)*
Historical inbound and outbound traffic aggregated from `metric_snapshots`. `days` range: 1 – 90.

---

## Access Log — `/access-log`

### `GET /access-log?limit=200` *(auth)*
Parsed nginx / Apache access log entries. `limit` range: 10 – 1000.

### `WS /access-log/stream?token=<jwt>` *(auth via query param)*
Live SSH auth-log stream (`/var/log/auth.log`).

---

## Network Diagnostics — `/network`

### `POST /network/ping` *(auth)*
Ping a host from the server. Returns RTT and raw output.

### `POST /network/dns` *(auth)*
DNS lookup (A, AAAA, MX, TXT, CNAME, NS, PTR, SOA) via `dig`.

### `POST /network/port-check` *(auth)*
TCP port reachability check via `nc -z`.

---

## File Browser — `/files`

### `GET /files?path=/var/log` *(auth)*
Directory listing. No path restriction — entire filesystem accessible.

### `GET /files/read?path=/etc/nginx/nginx.conf` *(auth)*
Read file content (max 2 MB). Returns 415 for binary files.

### `POST /files/write` *(admin)*
**Body** `{ "path": "/etc/nginx/nginx.conf", "content": "..." }`

### `POST /files/mkdir` *(admin)*
**Body** `{ "path": "/var/myapp/logs" }`

### `DELETE /files/delete?path=<path>` *(admin)*
Deletes a file or directory (recursive).

### `POST /files/copy` *(admin)*
**Body** `{ "src": "/etc/nginx/nginx.conf", "dst": "/etc/nginx/nginx.conf.bak" }`

### `POST /files/upload` *(admin)*
Multipart file upload. Maximum size controlled by `upload_max_size_mb` in `app_config`.

### `POST /files/chmod` *(admin)*
**Body** `{ "path": "/var/www/html", "mode": "755" }`

### `GET /files/download?path=<path>&token=<jwt>` *(auth via query param)*
Download a file or directory as a ZIP archive.

---

## Cleanup — `/cleanup`

All endpoints require admin role.

### `GET /cleanup/scan`
Scan disk for large files, old log files, temporary files, and unused Docker artifacts.

### `POST /cleanup/run`
Execute cleanup actions.

**Body** `{ "actions": ["docker_prune", "apt_clean", "old_logs"] }`

---

## Notifications — `/notifications`

### `GET /notifications` *(admin)*
### `PATCH /notifications` *(admin)*
Partial update — only send fields you want to change.

### `POST /notifications/test` *(admin)*
**Body** `{ "channel": "telegram" }   // "telegram" | "email"`

### `GET /notifications/history` *(admin)*
List of all sent alerts from `alert_history` table.

---

## Settings — `/settings`

### `GET /settings/services` *(admin)*
### `POST /settings/services` *(admin)*
### `PUT /settings/services/{id}` *(admin)*
### `DELETE /settings/services/{id}` *(admin)*

### `GET /settings/app` *(admin)*
Read the global app config (AI provider/model/key, upload size limit).

### `PATCH /settings/app` *(admin)*
Update app config fields.

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

## AI Assistant — `/ai`

All endpoints require auth. AI provider and API key must be configured in Settings.

### `POST /ai/chat`
Server Assistant chat. Sends conversation history; live server context (CPU, RAM, disk, uptime) is injected automatically into the system prompt.

**Body** `{ "messages": [{ "role": "user", "content": "..." }] }`

### `POST /ai/analyze-logs`
Analyze a log excerpt. Returns errors, anomalies, and security issues grouped by severity.

**Body** `{ "logs": "..." }`

### `POST /ai/cron-help`
Convert a natural-language schedule description to a cron expression.

**Body** `{ "description": "every weekday at 2 AM" }`

### `POST /ai/agent` *(admin)*
Execute a shell command on the server via AI agent mode.

**Body** `{ "prompt": "check disk usage" }`

---

## Audit Log — `/audit`

### `GET /audit?limit=100&offset=0&action=&user_email=` *(admin)*
List audit log entries (most recent first). Filterable by action and user email.

### `DELETE /audit` *(admin)*
Clear all audit log entries.

---

## SSH Keys — `/ssh-keys`

### `GET /ssh-keys` *(auth)*
List all public keys from `~/.ssh/authorized_keys`.

### `POST /ssh-keys` *(admin)*
Add a new public key.

### `DELETE /ssh-keys/{index}` *(admin)*
Remove key at the given list index.

---

## Weather — `/weather`

### `GET /weather` *(auth)*
Current weather data for the server's location (fetched from Open-Meteo based on server IP geolocation).

---

## WebSockets

### `WS /logs/stream?token=<jwt>&lines=300`
Live `journalctl -u server-iq -f` stream for the application itself.

### `WS /console?token=<jwt>`
PTY shell (bash) via WebSocket. xterm.js on the frontend.

### `WS /docker/logs/{id}?token=<jwt>`
Live Docker container log stream.

### `WS /access-log/stream?token=<jwt>`
Live SSH auth-log stream from `/var/log/auth.log`.

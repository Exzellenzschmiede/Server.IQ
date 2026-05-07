# User Guide

Server.IQ is a self-hosted VPS admin console accessible at `https://your-domain.example.com`.

---

## First Login

1. Open the URL in your browser. On a fresh installation you will be redirected to the **Setup page**.
2. Enter a name, email address and a secure password to create the first admin account.
3. After setup you are redirected to the login page. Log in with the credentials you just created.
4. Email matching is **case-insensitive** — `Admin@Example.com` and `admin@example.com` work equally.

---

## Navigation

**Desktop (≥ 768 px):** Fixed sidebar on the left, grouped into sections.

**Mobile:** Fixed bottom navigation bar with the most-used sections; remaining pages accessible via the sidebar (tap the menu icon).

### Sidebar sections

| Section | Pages |
|---|---|
| Overview | Dashboard, Health, Weather |
| Services & Containers | Services, Containers |
| Network & Security | Firewall, Fail2ban, Ports, SSL Certs |
| Hosting | Virtual Hosts, Databases, Backups, Email |
| System | Updates, Cron Jobs, Bandwidth, Access Log, Network, Files, Console, AI Assistant |
| Admin only | Notifications, Cleanup, Power, SSH Keys, Users, Audit Log, Settings, App Logs |

---

## Dashboard

Real-time overview, refreshed every **5 seconds**.

| Widget | Description |
|---|---|
| Gauges (4) | CPU %, RAM %, primary disk %, network activity |
| Metric cards | CPU (cores, frequency), RAM (used/total), Disk (used/total), Network (KB/s ↓↑) |
| Load Average | 1 / 5 / 15 minute load |
| Disk I/O | Current read and write rate |
| TCP Connections | Number of open TCP connections |
| Services grid | Quick status overview of all monitored services |
| History chart | CPU / RAM / Disk over 1 h / 2 h / 6 h / 24 h — data collected every 60 s |
| Top Processes | Sortable by CPU or RAM, refreshed every 10 s |
| All Disks | Progress bar for every mounted partition |

---

## Health

A structured health check page, refreshed every **60 seconds**.

- **Overall status banner** — OK (green) / Warning (yellow) / Critical (red)
- **Per-check cards**: each disk partition, RAM, CPU load, apt package updates
- Thresholds: ≥ 80 % → Warning, ≥ 90 % → Critical; load ≥ CPU count → Warning

---

## Weather

Displays the current weather and a short forecast for the server's geographic location (resolved automatically from the server's public IP via IP geolocation and Open-Meteo). No API key required.

---

## Services

Status of all configured systemd services, checked every **30 seconds**.

**Actions (admin only):** Start, Stop, Restart.

**Expand a row (▸)** to see:
- Description, active/sub state, unit file state
- Main PID, memory usage, CPU time, active since timestamp
- Path to the unit file

**Logs button:** Opens a modal with the last 50 / 100 / 200 / 500 lines from `journalctl -u <service>`. Error lines appear in red, warnings in yellow.

**Adding services** → go to Settings.

---

## Docker

Lists all Docker containers (running and stopped).

| Action | Description |
|---|---|
| Start / Stop / Restart | Lifecycle control |
| Delete | Removes the container (optional `force`) |
| Reinstall | Pulls the latest image, removes the old container, recreates with same config |
| Logs | Live log stream via WebSocket |
| Stats | CPU % and memory for running containers (auto-refreshed when expanded) |

Expanded card shows: image, created time, volumes (bind mounts), networks, restart policy.

---

## Firewall

Manages `ufw` (Uncomplicated Firewall).

- **Enable / Disable** the firewall
- **Rule table** — shows rule number, destination port/service, action (ALLOW / DENY), source
- **Add rule** — enter port (e.g. `8080`), protocol (`tcp` / `udp` / `both`) and action
- **Delete** — removes a rule by its number

Changes take effect immediately via `sudo ufw ...`.

---

## Fail2ban

Overview of all active fail2ban jails.

- **Status card** — total number of jails and total banned IPs
- **Per-jail accordion** — lists each banned IP with the option to unban (admin only)

**Unban:** click the unban button next to any IP. The command `fail2ban-client set <jail> unbanip <ip>` is executed on the server.

---

## Ports

Lists all open TCP and UDP ports currently listening on the server, along with the process name and PID holding each port. Useful for auditing unexpected open ports.

---

## SSL Certificates

Shows all Let's Encrypt certificates under `/etc/letsencrypt/live/`:

- Domain name
- Valid from / expires on dates
- Days remaining (color-coded: green > 30 days, yellow ≤ 30, red ≤ 7 or expired)

**Renew (admin only):** runs `certbot renew --cert-name <domain>` on the server. A spinner is shown while certbot runs (up to 120 s). The full certbot output is displayed so you can see whether the certificate was actually renewed or skipped (certbot skips renewal when the certificate is still valid for more than 30 days).

---

## Virtual Hosts

Manage nginx virtual hosts (web hosting configs).

**List view** — shows all sites in `/etc/nginx/sites-available/` with enabled/disabled status.

| Action | Description |
|---|---|
| Create | Enter domain, document root, type (static / PHP / proxy) and optional PHP version or upstream URL |
| Enable / Disable | Toggles the `sites-enabled` symlink and reloads nginx |
| Edit config | Opens the raw nginx config in a text editor; saves and reloads nginx on save |
| Request SSL | Runs certbot for the domain; automatically updates the config to use HTTPS |
| Delete | Removes the config file and disables the site |

All actions require admin role.

---

## Databases

Manage PostgreSQL and MySQL databases via saved connection profiles.

**Connections** — define connections by name, type, host, port, and credentials. Connections are stored encrypted in the database.

Once a connection is selected:
- **Databases tab**: list, create, and drop databases
- **Tables tab**: browse tables in a selected database
- **Users tab** (PostgreSQL only): list, create, drop users and grant privileges
- **Query tab**: run ad-hoc SQL queries and view results in a table

All database operations require admin role.

---

## Backups

Create and manage backup archives of file paths and databases.

**Creating a backup:**
1. Enter a name for the backup
2. Optionally add filesystem paths to include (e.g. `/var/www`, `/etc/nginx`)
3. Optionally select a database connection and database name to include a dump
4. Click **Create** — the backup runs in the background

**Backup list** — shows name, type, creation time, size, and status (running / done / error).

**Download** — downloads the archive as a `.tar.gz` file.

**Delete** — removes the record and the archive from disk.

All actions require admin role.

---

## Email

Manage a Postfix + Dovecot mail server installation.

**Status card** — shows whether Postfix and Dovecot services are active.

**Mailboxes tab:**
- List all mailboxes (from `/etc/dovecot/userdb` or virtual mailbox config)
- Create a new mailbox with email address and password
- Delete a mailbox

**Aliases tab:**
- List all aliases (from `/etc/postfix/virtual`)
- Create an alias mapping source → destination
- Delete an alias

**Queue tab:**
- Inspect the current Postfix mail queue (`mailq`)
- Flush the queue (deliver all pending messages)
- Delete individual queue items

All actions require admin role.

---

## Updates

Manage system package updates.

- **Pending updates list** — packages with available upgrades (from `apt list --upgradable`)
- **Fetch updates (admin)** — runs `apt update` to refresh the package index
- **Apply upgrades (admin)** — runs `apt upgrade -y` and streams output

---

## Cron Jobs

Manages the crontab of the service user (`root`).

- **Preset buttons** for common schedules (hourly, daily, weekly, monthly, etc.)
- **AI helper** — describe the schedule in plain English; the AI converts it to a cron expression (requires AI configured in Settings)
- **Add job** — cron expression + shell command
- **Delete** — removes a job by its position

Example: `0 2 * * *` + `/opt/server-iq/backup.sh >> /var/log/backup.log 2>&1`

---

## Bandwidth

Historical network traffic chart using data collected every 60 seconds by the background metric task.

- **Chart**: inbound (download) and outbound (upload) traffic plotted over time
- **Range selector**: 1 / 7 / 30 / 90 days
- Data is aggregated from the `metric_snapshots` table; long ranges use hourly averages

---

## Access Log

Web server and SSH access log viewer.

- **Access log table**: parsed nginx / Apache access log entries (up to 1,000 lines) showing timestamp, IP, HTTP method, path, status code and response size
- **Live SSH log**: WebSocket stream of `/var/log/auth.log` showing real-time login attempts and authentication events

---

## Network

Network diagnostics run **from the server's perspective**.

- **Ping** — ICMP ping to any host; shows RTT and packet loss
- **DNS Lookup** — supports A, AAAA, MX, TXT, CNAME, NS, PTR, SOA record types
- **Port Check** — TCP connectivity test to host:port

Results are displayed immediately after the server-side check completes.

---

## File Browser

Full filesystem browser — no path restrictions, including hidden files (shown in grey).

- **Navigate** directories by clicking; use **← Back** or the **breadcrumb** to go up
- **View** text files inline (up to 2 MB)
- **Edit** text files — click **Edit**, modify in the textarea, click **Save**; binary files and files > 2 MB are read-only

**Actions (admin only):**
- **+ New File** — creates an empty file in the current directory
- **+ New Folder** — creates a directory
- **Upload** — drag and drop or select files; maximum size configured in Settings
- **Copy** — copies a file or directory to an absolute destination path
- **Change permissions** — set Unix permissions (e.g. `755`)
- **Download** — downloads the file or directory as a ZIP archive
- **Delete** — deletes the file or directory (recursive for directories); requires confirmation

---

## Console

A full PTY terminal running `bash` in the browser via WebSocket (xterm.js).

- Works like any SSH terminal
- Authenticated via JWT query parameter
- Session ends when you leave the page or close the connection

---

## AI Assistant

Chat interface for interacting with an AI model that has live server context.

**Features:**
- **Chat** — the AI automatically receives current CPU, RAM, disk and uptime data and can answer questions about your server
- **Log Analysis** — paste a log excerpt; the AI identifies errors, anomalies and security issues grouped by severity
- **Cron Helper** — describe a schedule in plain language; the AI returns a cron expression
- **Agent mode (admin only)** — instruct the AI to execute shell commands on the server

**Setup:** configure AI provider (Anthropic, OpenAI, etc.), model, and API key in Settings before use.

Markdown output (including tables and code blocks) is rendered in the chat.

---

## Notifications *(admin only)*

Configure alerts for service state changes.

### Telegram
1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token
2. Get your Chat ID (e.g. from [@userinfobot](https://t.me/userinfobot))
3. Enable Telegram, paste token and chat ID, save, then click **Test**

### Email (SMTP)
For a local **Postfix** installation:
- Host: `localhost`, Port: `25`, leave username and password empty

For external SMTP (e.g. Gmail):
- Host: `smtp.gmail.com`, Port: `587`, User: Gmail address, Password: app password

### Alert settings
- **Check interval** — how often services are checked (minutes)
- **On failure** — send alert when a service goes down
- **On recovery** — send alert when a service comes back up

### Alert history
The **History** tab shows a log of all sent alerts with timestamp, channel (Telegram / email), service name, and event type (down / recovery).

---

## Cleanup *(admin only)*

Disk cleanup utility.

- **Scan** — analyzes disk for large files, old log files, temporary files, and unused Docker images / volumes / containers
- **Run cleanup** — select which actions to perform (Docker prune, `apt clean`, old log removal) and execute

---

## Power *(admin only)*

Reboot or shut down the server.

- **Reboot** — runs `reboot`
- **Shutdown** — runs `shutdown now`

Both actions display a confirmation dialog before executing.

---

## SSH Keys *(admin only)*

Manage the `~/.ssh/authorized_keys` file.

- **List** all public keys with their comment/label
- **Add** a new public key (paste the full key string)
- **Delete** a key by its position in the file

---

## Users *(admin only)*

- **List** all users with their role and creation date
- **Create** new user (name, email, password, role)
- **Edit** name, email, role
- **Reset password** — generates a new password or lets you enter one manually
- **Delete** user (cannot delete your own account)
- **Generate password** button — creates a strong random password

---

## Audit Log *(admin only)*

Full history of admin actions performed through the application.

- Shows: timestamp, user email, action type, affected resource, detail, and client IP
- Filterable by action and user email
- **Clear** — permanently deletes all audit log entries

---

## Settings *(admin only)*

### Monitored Services
Manage which systemd services appear on the Services page and in the notification monitor.

Each service has:
- **Key** — must match the exact systemd service name (e.g. `nginx`, `postgresql`)
- **Display name** — shown in the UI
- **Host + Port** — used for TCP health checks; leave empty for Docker (uses socket check)
- **Enabled** toggle — disabled services are excluded from checks and alerts

Default services (seeded on first start): `nginx`, `postgresql`, `ssh`, `docker`.

### AI Configuration
- **Provider** — AI provider name (e.g. `anthropic`, `openai`)
- **Model** — model identifier (e.g. `claude-sonnet-4-6`)
- **API Key** — stored in the database; required to use the AI Assistant

### Upload Limit
- **Max upload size (MB)** — controls the maximum file size accepted by the file upload endpoint (default: 100 MB)

---

## App Logs *(admin only)*

Live stream of `journalctl -u server-iq -f` — the application's own log output.

- Error lines highlighted in red, warnings in yellow
- **Auto-scroll** checkbox keeps the view at the bottom
- **Clear** button wipes the display buffer (does not affect the actual journal)
- Buffer holds up to 2,000 lines

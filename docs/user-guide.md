# User Guide

Server.IQ is a self-hosted VPS admin console accessible at `https://server.exzellenzschmiede.de`.

---

## First Login

1. Open the URL in your browser. On a fresh installation you will be redirected to the **Setup page**.
2. Enter a name, email address and a secure password to create the first admin account.
3. After setup you are redirected to the login page. Log in with the credentials you just created.
4. Email matching is **case-insensitive** — `Admin@Example.com` and `admin@example.com` work equally.

---

## Navigation

**Desktop (≥768 px):** Fixed sidebar on the left.

**Mobile:** Fixed bottom navigation bar with the most-used sections; remaining pages accessible via sidebar (tap the menu).

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

## Services

Status of all configured systemd services, checked every **30 seconds** via TCP connect or Docker socket ping.

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

> Changes take effect immediately via `sudo ufw ...`.

---

## SSL Certificates

Shows all Let's Encrypt certificates under `/etc/letsencrypt/live/`:

- Domain name
- Valid from / expires on dates
- Days remaining (color-coded: green > 30 days, yellow ≤ 30, red ≤ 7 or expired)

---

## Cron Jobs

Manages the crontab of the service user (`root`).

- **Preset buttons** for common schedules (hourly, daily, weekly, etc.)
- **Add job** — cron expression + shell command
- **Delete** — removes a job by its position

Example: `0 2 * * *` + `/opt/server-iq/backup.sh >> /var/log/backup.log 2>&1`

---

## File Browser

Full filesystem browser — no path restrictions, including hidden files (shown in grey).

- **Navigate** directories by clicking; use **← Back** or the **breadcrumb** path to go up
- **View** text files inline (up to 2 MB)
- **Edit** text files — click **✏ Bearbeiten**, modify in the textarea, click **💾 Speichern**
  - Binary files and files > 2 MB are read-only
- Files are written directly to disk; be careful editing system files

---

## Console

A full PTY terminal running `bash` in the browser via WebSocket (xterm.js).

- Works like any SSH terminal
- Authenticated via JWT query parameter
- Session ends when you leave the page or close the connection

---

## App Logs

Live stream of `journalctl -u server-iq -f` — the application's own log output.

- Error lines highlighted in red, warnings in yellow
- **Auto-scroll** checkbox keeps the view at the bottom
- **Clear** button wipes the display buffer (does not affect the actual journal)
- Buffer holds up to 2,000 lines

---

## Notifications

Configure alerts for service state changes.

### Telegram
1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token
2. Get your Chat ID (e.g. from [@userinfobot](https://t.me/userinfobot))
3. Enable Telegram, paste token and chat ID, save, then click **Test senden**

### Email (SMTP)
For a local **Postfix** installation:
- Host: `localhost`
- Port: `25`
- Leave username and password empty

For external SMTP (e.g. Gmail):
- Host: `smtp.gmail.com`, Port: `587`
- User: your Gmail address, Password: app password

### Alert settings
- **Prüfintervall** — how often services are checked (minutes)
- **Bei Ausfall** — send alert when a service goes down
- **Bei Wiederherstellung** — send alert when a service comes back up

---

## Users *(admin only)*

- **List** all users with their role and creation date
- **Create** new user (name, email, password, role)
- **Edit** name, email, role
- **Reset password** — generates a new password or lets you enter one
- **Delete** user (cannot delete your own account)
- **Generate password** button — creates a strong random password

---

## Settings *(admin only)*

Manage which systemd services are monitored on the Services page and in the notification monitor.

Each service has:
- **Key** — must match the exact systemd service name (e.g. `nginx`, `postgresql`)
- **Display name** — shown in the UI
- **Host + Port** — used for TCP health checks; leave empty for Docker (uses socket check)
- **Enabled** toggle — unmonitored services are excluded from checks and alerts

Default services (seeded on first start): `nginx`, `postgresql`, `ssh`, `docker`.

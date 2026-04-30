# Server.IQ — CLAUDE.md

## Projekt-Übersicht

Self-hosted VPS Admin Console als Progressive Web App (PWA). Läuft als Docker-Container auf dem VPS, erreichbar unter `https://server.exzellenzschmiede.de`. Ermöglicht Echtzeit-Monitoring (CPU, RAM, Disk, Network, Services) sowie vollständige Docker-Container-Verwaltung (Start/Stop/Delete/Reinstall/Logs).

---

## Workflow-Regel

**Nach jedem abgeschlossenen Prompt einen Commit auf `main` pushen.**

```bash
git add -A
git commit -m "beschreibender commit-message"
git push origin main
```

Der Push auf `main` löst automatisch das CI/CD-Deployment auf den VPS aus.

---

## Infrastruktur

| Parameter | Wert |
|---|---|
| VPS IP | `217.154.199.218` |
| Domain | `server.exzellenzschmiede.de` |
| Backend-Port (Host) | `8100` (konfigurierbar via `.env`) |
| Frontend-Port (Host) | `8101` (konfigurierbar via `.env`) |
| PostgreSQL | Host-Postgres auf `172.17.0.1:5432` (vom Docker-Container aus) |
| DB Name | `server_iq` |
| DB User | `serveriq` |
| Deploy-User | `deploy` |
| SSL | Let's Encrypt unter `/etc/letsencrypt/live/server.exzellenzschmiede.de/` |

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | Python 3.12, FastAPI, uvicorn |
| System-Monitoring | psutil (CPU/RAM/Disk/Network), subprocess (systemctl) |
| Docker-Verwaltung | docker-py SDK |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Datenbank | SQLAlchemy async + asyncpg → Host-PostgreSQL |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| PWA | vite-plugin-pwa (Service Worker + Manifest) |
| Proxy | Host-nginx mit eigenem Server-Block |
| CI/CD | GitHub Actions → GHCR → SSH-Deploy auf VPS |

---

## Projekt-Struktur

```
Server.IQ/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI-App, Routers, CORS, Rate-Limit
│   │   ├── config.py            # pydantic-settings (alle Env-Vars)
│   │   ├── database.py          # SQLAlchemy async engine + Session
│   │   ├── models.py            # User-Tabelle
│   │   ├── dependencies.py      # get_current_user (JWT-Dependency)
│   │   ├── auth/
│   │   │   ├── router.py        # /auth/setup, /login, /refresh, /me
│   │   │   ├── schemas.py
│   │   │   └── service.py       # bcrypt, JWT encode/decode
│   │   ├── system/
│   │   │   ├── router.py        # /system/metrics, /services, /info
│   │   │   ├── schemas.py
│   │   │   └── service.py       # psutil + systemctl subprocess
│   │   ├── docker_mgmt/
│   │   │   ├── router.py        # /docker/containers CRUD + WS /logs/{id}
│   │   │   ├── schemas.py
│   │   │   └── service.py       # docker-py SDK
│   │   └── websockets/
│   │       └── manager.py       # WebSocket Log-Streaming
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router, SetupGuard, ProtectedRoute
│   │   ├── api/                 # client.ts (Axios+JWT), auth/system/docker
│   │   ├── auth/                # AuthContext, ProtectedRoute
│   │   ├── hooks/               # useMetrics, useContainers, useContainerLogs
│   │   ├── pages/               # Setup, Login, Dashboard, Services, Containers, Logs
│   │   ├── components/
│   │   │   ├── layout/          # AppShell, Sidebar (Desktop), BottomNav (Mobile)
│   │   │   ├── ui/              # GaugeChart, StatusBadge, MetricCard, Spinner, Button
│   │   │   └── containers/      # ContainerActions, LogViewer
│   │   └── types/               # auth.ts, system.ts, docker.ts
│   ├── Dockerfile               # Node build → nginx:alpine
│   ├── nginx.conf               # SPA-Fallback auf index.html
│   └── vite.config.ts           # vite-plugin-pwa, /api-Proxy auf Backend
│
├── nginx/
│   └── server-iq.conf           # Host-nginx Server-Block (wird per CI/CD deployed)
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # build → GHCR push → SCP nginx → SSH deploy
│
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

---

## API-Endpunkte

### Auth — `/api/v1/auth`
| Methode | Pfad | Auth | Beschreibung |
|---|---|---|---|
| GET | `/auth/setup` | Nein | Prüft ob noch kein Admin existiert |
| POST | `/auth/setup` | Nein | Legt ersten Admin an (nur einmalig) |
| POST | `/auth/login` | Nein | Gibt access_token (15 min) + refresh_token (7 d) zurück |
| POST | `/auth/refresh` | Nein | Tauscht refresh_token gegen neuen access_token |
| GET | `/auth/me` | JWT | Aktueller User |

### System — `/api/v1/system`
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/system/metrics` | CPU, RAM, Disk, Network (psutil) |
| GET | `/system/services` | nginx, postgresql, docker, ssh via systemctl |
| GET | `/system/info` | Hostname, OS, Kernel, Uptime |

### Docker — `/api/v1/docker`
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/docker/containers` | Alle Container (inkl. gestoppte) |
| GET | `/docker/containers/{id}` | Einzelner Container |
| POST | `/docker/containers/{id}/start` | Container starten |
| POST | `/docker/containers/{id}/stop` | Container stoppen |
| DELETE | `/docker/containers/{id}` | Container löschen (`?force=true`) |
| POST | `/docker/containers/{id}/reinstall` | Image pullen + neu erstellen |
| GET | `/docker/images` | Lokale Images |
| WS | `/docker/logs/{id}?token=JWT` | Live Log-Stream |

---

## Schlüssel-Entscheidungen & Hinweise

- **Docker Socket**: Backend mountet `/var/run/docker.sock` read-write. FastAPI läuft als Non-Root-User im Container.
- **Container-ID-Validierung**: Alle Container-IDs werden gegen `[a-f0-9]{12,64}` validiert bevor sie an docker-py übergeben werden.
- **WebSocket-Auth**: JWT kann nicht im Header gesendet werden → wird als `?token=` Query-Parameter übergeben.
- **Token-Refresh**: Axios-Interceptor in `api/client.ts` fängt 401-Fehler ab, refresht automatisch und wiederholt den Original-Request.
- **First-Run-Setup**: `App.tsx` prüft beim Start `GET /auth/setup`. Ist `setup_required: true`, wird auf `/setup` umgeleitet. Der Setup-Endpoint ist nach dem ersten User gesperrt (HTTP 409).
- **PostgreSQL-Verbindung**: Docker-Container erreichen Host-Postgres über `host.docker.internal` (in docker-compose als `host-gateway` konfiguriert).
- **Ports**: Keine doppelten Ports auf dem VPS — 8100 und 8101 waren laut `ss -tulnp` frei.
- **nginx**: Der Host-nginx verwaltet bereits Port 80/443. Unser Server-Block wird per CI/CD nach `/etc/nginx/sites-available/server-iq.conf` deployed und verlinkt.
- **Variablen-Substitution in nginx**: `${BACKEND_PORT}` und `${FRONTEND_PORT}` werden im Deploy-Schritt per `sed` durch echte Werte aus `.env` ersetzt.

---

## CI/CD-Pipeline (GitHub Actions)

**Trigger**: Push auf `main`

**Jobs**:
1. `build-and-push`: Baut Backend- und Frontend-Docker-Images, pusht sie zu GHCR
2. `deploy`:
   - Lädt `nginx/server-iq.conf` per SCP auf den VPS
   - Zieht neue Images
   - Startet Container neu via `docker compose up -d`
   - Substituiert Port-Variablen in nginx-Config
   - Verlinkt Config und ruft `sudo nginx -t && sudo systemctl reload nginx` auf

**Required GitHub Secrets**:
| Secret | Beschreibung |
|---|---|
| `VPS_HOST` | `217.154.199.218` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Privater ED25519-Key des deploy-Users |

---

## Lokale Entwicklung

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # anpassen
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # Proxy auf localhost:8100 (BACKEND_PORT)
```

### Zusammen (docker-compose lokal)
```bash
cp .env.example .env   # anpassen
docker compose up --build
```

---

## Überwachte Services

Definiert in `backend/app/system/service.py` → `MONITORED_SERVICES`:
```python
MONITORED_SERVICES = [
    ("nginx", "NGINX"),
    ("postgresql", "PostgreSQL"),
    ("docker", "Docker"),
    ("ssh", "SSH"),
]
```

Weitere Services können hier ergänzt werden — sie erscheinen automatisch auf der Services-Seite.

---

## Sicherheitshinweise

- `.env` darf **nie** ins Repository committet werden (steht in `.gitignore`)
- `SECRET_KEY` immer mit `openssl rand -hex 32` generieren
- Rate-Limiting auf Login/Setup: 5 Requests/Minute pro IP (slowapi)
- HSTS, X-Frame-Options, X-Content-Type-Options sind im nginx-Block gesetzt
- Der deploy-User hat nur minimale sudo-Rechte (nur 4 spezifische Befehle, NOPASSWD)

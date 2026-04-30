#!/usr/bin/env bash
# Server.IQ — first-time setup on the VPS
# Run as root: sudo bash setup.sh
set -euo pipefail

APP_DIR=/opt/server-iq
APP_USER=deploy

echo "=== Server.IQ Setup ==="

# ── Prerequisites ────────────────────────────────────────────────────────────
command -v python3 >/dev/null || { echo "python3 required"; exit 1; }
command -v node    >/dev/null || { echo "node required (nodejs LTS)"; exit 1; }
command -v git     >/dev/null || { echo "git required"; exit 1; }

# ── Clone / update repo ──────────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
    git clone https://github.com/exzellenzschmiede/server.iq "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── Backend: Python venv ─────────────────────────────────────────────────────
cd "$APP_DIR/backend"
if [ ! -d .venv ]; then
    sudo -u "$APP_USER" python3 -m venv .venv
fi
sudo -u "$APP_USER" .venv/bin/pip install -q --upgrade pip
sudo -u "$APP_USER" .venv/bin/pip install -q -r requirements.txt
echo "✓ Backend dependencies installed"

# ── Frontend: build ──────────────────────────────────────────────────────────
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm ci --silent
sudo -u "$APP_USER" npm run build
echo "✓ Frontend built"

# ── Environment file ─────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo ""
    echo "⚠️  Created $APP_DIR/.env — please edit it now:"
    echo "   nano $APP_DIR/.env"
    echo ""
fi

# ── docker group for deploy user ─────────────────────────────────────────────
if ! groups "$APP_USER" | grep -q docker; then
    usermod -aG docker "$APP_USER"
    echo "✓ Added $APP_USER to docker group (re-login required)"
fi

# ── systemd service ──────────────────────────────────────────────────────────
cp "$APP_DIR/server-iq.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable server-iq
echo "✓ systemd service installed and enabled"

# ── nginx ────────────────────────────────────────────────────────────────────
cp "$APP_DIR/nginx/server-iq.conf" /etc/nginx/sites-available/server-iq.conf
ln -sf /etc/nginx/sites-available/server-iq.conf \
       /etc/nginx/sites-enabled/server-iq.conf
nginx -t
echo "✓ nginx config deployed"

# ── sudoers for deploy user ──────────────────────────────────────────────────
SUDOERS_FILE=/etc/sudoers.d/server-iq
cat > "$SUDOERS_FILE" << 'EOF'
deploy ALL=(ALL) NOPASSWD: \
  /bin/systemctl start *, \
  /bin/systemctl stop *, \
  /bin/systemctl restart *, \
  /bin/systemctl reload *, \
  /usr/bin/systemctl start *, \
  /usr/bin/systemctl stop *, \
  /usr/bin/systemctl restart *, \
  /usr/bin/systemctl reload *, \
  /usr/sbin/nginx -t, \
  /bin/nginx -t, \
  /bin/cp /opt/server-iq/nginx/server-iq.conf /etc/nginx/sites-available/server-iq.conf, \
  /bin/ln -sf /etc/nginx/sites-available/server-iq.conf /etc/nginx/sites-enabled/server-iq.conf, \
  /bin/cp /opt/server-iq/server-iq.service /etc/systemd/system/server-iq.service, \
  /usr/bin/cp /opt/server-iq/server-iq.service /etc/systemd/system/server-iq.service, \
  /bin/systemctl daemon-reload, \
  /usr/bin/systemctl daemon-reload, \
  /usr/sbin/ufw status numbered, \
  /usr/sbin/ufw --force enable, \
  /usr/sbin/ufw --force disable, \
  /usr/sbin/ufw allow *, \
  /usr/sbin/ufw deny *, \
  /usr/sbin/ufw reject *, \
  /usr/sbin/ufw limit *, \
  /usr/sbin/ufw --force delete *
EOF
chmod 440 "$SUDOERS_FILE"
echo "✓ sudoers configured"

echo ""
echo "=== Next steps ==="
echo "1. Edit /opt/server-iq/.env (if not done already)"
echo "2. sudo systemctl start server-iq"
echo "3. sudo systemctl reload nginx"
echo "4. Check logs: journalctl -u server-iq -f"

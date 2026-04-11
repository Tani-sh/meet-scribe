#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AI Scribe — EC2 Instance Provisioning Script
# Run as root on a fresh Ubuntu 22.04 t3.micro instance
#
# Usage: ssh ubuntu@<EC2_IP> 'bash -s' < scripts/setup-ec2.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
echo "═══════════════════════════════════════════════"
echo "  🏗️  AI Scribe — EC2 Setup Starting"
echo "═══════════════════════════════════════════════"

# ─── 1. System Updates ───────────────────────────────────────────────────────
echo "[1/6] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Swap File (CRITICAL for Puppeteer on t3.micro) ──────────────────────
echo "[2/6] Allocating 2GB swap file..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Tune swappiness for better Puppeteer performance
  sysctl vm.swappiness=60
  echo 'vm.swappiness=60' >> /etc/sysctl.conf
  echo "  ✅ 2GB swap allocated and persisted"
else
  echo "  ⏭️  Swap already exists"
fi

# ─── 3. Node.js 18 LTS ──────────────────────────────────────────────────────
echo "[3/6] Installing Node.js 18..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
  echo "  ✅ Node.js $(node -v) installed"
else
  echo "  ⏭️  Node.js $(node -v) already installed"
fi

# ─── 4. Chromium + Xvfb + Rendering Dependencies ────────────────────────────
echo "[4/6] Installing Chromium, Xvfb, and rendering libraries..."
apt-get install -y --no-install-recommends \
  chromium-browser \
  xvfb \
  xauth \
  dbus-x11 \
  fonts-liberation \
  fonts-noto \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  git

echo "  ✅ Chromium $(chromium-browser --version 2>/dev/null || echo 'installed')"

# ─── 5. Application Setup ───────────────────────────────────────────────────
echo "[5/6] Setting up application directory..."
APP_DIR="/opt/ai-scribe"
mkdir -p "$APP_DIR/data/chrome-profile"
mkdir -p "$APP_DIR/data/transcripts"
mkdir -p "$APP_DIR/data/summaries"
mkdir -p "$APP_DIR/public"

# Create a non-root user for the app
if ! id -u aiscribe &>/dev/null; then
  useradd -r -s /bin/false aiscribe
fi
chown -R aiscribe:aiscribe "$APP_DIR"

# ─── 6. Systemd Service ─────────────────────────────────────────────────────
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/ai-scribe.service << 'EOF'
[Unit]
Description=AI Scribe - Google Meet Bot
After=network.target

[Service]
Type=simple
User=aiscribe
WorkingDirectory=/opt/ai-scribe
EnvironmentFile=/opt/ai-scribe/.env

# Xvfb virtual display + Node server
ExecStartPre=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac &
ExecStart=/usr/bin/node server.js

# Environment
Environment=DISPLAY=:99
Environment=NODE_ENV=production
Environment=PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
Environment=PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Memory & restart policies
Restart=on-failure
RestartSec=10
MemoryMax=2500M

# Logging
StandardOutput=append:/var/log/ai-scribe/app.log
StandardError=append:/var/log/ai-scribe/error.log

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/log/ai-scribe
chown aiscribe:aiscribe /var/log/ai-scribe

systemctl daemon-reload
systemctl enable ai-scribe

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ EC2 Setup Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Clone your repo:     cd /opt/ai-scribe && git clone <repo> ."
echo "  2. Install deps:        npm ci --omit=dev"
echo "  3. Upload .env:         scp .env ubuntu@<IP>:/opt/ai-scribe/.env"
echo "  4. Upload Chrome profile: bash scripts/upload-profile.sh <IP>"
echo "  5. Start the service:   sudo systemctl start ai-scribe"
echo "  6. Check logs:          sudo journalctl -u ai-scribe -f"
echo ""
echo "  Swap status:"
swapon -s
echo ""
echo "  Memory:"
free -h

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deploy latest code to EC2
# Pulls from GitHub, installs deps, and restarts the service.
#
# Usage: bash scripts/deploy.sh <EC2_IP> [SSH_KEY_PATH]
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

EC2_IP="${1:?Usage: bash deploy.sh <EC2_IP> [SSH_KEY_PATH]}"
SSH_KEY="${2:-~/.ssh/id_rsa}"

echo "🚀 Deploying AI Scribe to $EC2_IP..."

ssh -i "$SSH_KEY" "ubuntu@${EC2_IP}" << 'REMOTE'
  set -euo pipefail
  cd /opt/ai-scribe

  echo "📥 Pulling latest code..."
  sudo -u aiscribe git pull origin main

  echo "📦 Installing dependencies..."
  sudo -u aiscribe npm ci --omit=dev

  echo "🔄 Restarting service..."
  sudo systemctl restart ai-scribe

  echo "✅ Deployed! Checking status..."
  sleep 2
  sudo systemctl status ai-scribe --no-pager -l | head -20
REMOTE

echo ""
echo "✅ Deployment complete!"
echo "   Logs: ssh -i $SSH_KEY ubuntu@$EC2_IP 'sudo journalctl -u ai-scribe -f'"

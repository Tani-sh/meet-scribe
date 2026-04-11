#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Upload Chrome Profile to EC2
# Transfers the locally authenticated Chrome profile to the EC2 instance.
#
# Usage: bash scripts/upload-profile.sh <EC2_IP> [SSH_KEY_PATH]
# Example: bash scripts/upload-profile.sh 13.232.xx.xx ~/.ssh/ai-scribe.pem
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

EC2_IP="${1:?Usage: bash upload-profile.sh <EC2_IP> [SSH_KEY_PATH]}"
SSH_KEY="${2:-~/.ssh/id_rsa}"
PROFILE_DIR="data/chrome-profile"
REMOTE_DIR="/opt/ai-scribe/data/chrome-profile"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "❌ Local Chrome profile not found at: $PROFILE_DIR"
  echo "   Run 'node login.js' first to create an authenticated profile."
  exit 1
fi

# Remove lock files before upload
echo "🧹 Cleaning lock files..."
rm -f "$PROFILE_DIR/SingletonLock" \
      "$PROFILE_DIR/SingletonCookie" \
      "$PROFILE_DIR/SingletonSocket" \
      "$PROFILE_DIR/DevToolsActivePort"

# Calculate size
SIZE=$(du -sh "$PROFILE_DIR" | cut -f1)
echo "📦 Uploading Chrome profile ($SIZE) to $EC2_IP..."

# Upload
scp -i "$SSH_KEY" -r "$PROFILE_DIR/" "ubuntu@${EC2_IP}:${REMOTE_DIR}"

# Fix ownership on the remote server
ssh -i "$SSH_KEY" "ubuntu@${EC2_IP}" "sudo chown -R aiscribe:aiscribe ${REMOTE_DIR}"

echo ""
echo "✅ Chrome profile uploaded to $EC2_IP:$REMOTE_DIR"
echo "   Restart the service: ssh ubuntu@$EC2_IP 'sudo systemctl restart ai-scribe'"

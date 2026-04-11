FROM node:18-slim

# Install Xvfb (virtual display) + all Chrome rendering dependencies
# We let Puppeteer download its own bundled Chrome (not the Debian chromium package)
# to avoid version mismatches between system Chromium and Puppeteer v24 (Chrome 146+).
RUN apt-get update && apt-get install -y \
  # Virtual display server — Chrome runs headful inside a virtual monitor
  xvfb \
  xauth \
  dbus-x11 \
  # Chrome shared library dependencies
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
  libxcursor1 \
  libxdamage1 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  wget \
  ca-certificates \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Virtual display settings — Xvfb simulates a real 1080p monitor
ENV DISPLAY=:99
ENV XVFB_WHD=1920x1080x24

WORKDIR /app

COPY package*.json ./

# Install all deps FIRST (Puppeteer will download its bundled Chrome here)
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is intentionally NOT set so Puppeteer
# downloads the exact Chrome version it was built for (Chrome 146+)
RUN npm ci --omit=dev

# The Puppeteer bundled Chrome is stored in node_modules/.cache/puppeteer
# Point PUPPETEER_EXECUTABLE_PATH to it so the bot uses the right binary
RUN PUPPETEER_EXEC=$(./node_modules/.bin/node -e "const p=require('puppeteer'); console.log(p.executablePath())" 2>/dev/null || \
    find /root/.cache/puppeteer /home -name "chrome" -type f 2>/dev/null | head -1 || \
    find /app/node_modules -name "chrome" -type f 2>/dev/null | head -1) && \
    echo "Puppeteer Chrome path: $PUPPETEER_EXEC" && \
    echo "PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_EXEC" >> /etc/environment

COPY . .

# Create required runtime directories
RUN mkdir -p data/transcripts data/summaries public data/chrome-profile

# Startup: launch Xvfb (virtual display), set the chrome executable path, then start Node
CMD export PUPPETEER_EXECUTABLE_PATH=$(node -e "try{const p=require('puppeteer');console.log(p.executablePath())}catch(e){}" 2>/dev/null) && \
    echo "Using Chrome: $PUPPETEER_EXECUTABLE_PATH" && \
    Xvfb :99 -screen 0 ${XVFB_WHD} -ac & \
    sleep 2 && \
    node server.js

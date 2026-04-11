FROM node:18-slim

# Install Chrome, Xvfb (virtual display), and all rendering dependencies
RUN apt-get update && apt-get install -y \
  # Virtual display server (key for headful evasion)
  xvfb \
  xauth \
  dbus-x11 \
  # Chrome rendering dependencies
  chromium \
  fonts-liberation \
  fonts-noto \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libgbm1 \
  libgconf-2-4 \
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
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Virtual display settings — Xvfb will make Chrome think it has a real 1080p monitor
ENV DISPLAY=:99
ENV XVFB_WHD=1920x1080x24

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create data and public directories
RUN mkdir -p data/transcripts data/summaries public

# Startup script: launch Xvfb first, then Node
# Xvfb simulates a 1080p physical monitor — Chrome runs in full graphical mode
CMD Xvfb :99 -screen 0 ${XVFB_WHD} -ac & \
    sleep 1 && \
    node server.js

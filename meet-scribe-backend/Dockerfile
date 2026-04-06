FROM node:18-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  python3 \
  python3-venv \
  python3-pip \
  --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Configure Python Virtual Environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

COPY package*.json ./
RUN npm ci --omit=dev

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directories
RUN mkdir -p data/transcripts data/summaries

EXPOSE 3001

CMD ["node", "server.js"]

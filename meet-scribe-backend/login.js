/**
 * Login Helper — Opens Chrome for user to sign into Google once.
 * The profile is saved persistently so the bot stays authenticated.
 * Run: node login.js
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR = path.join(__dirname, 'data', 'chrome-profile');

async function openLoginWindow() {
  // Ensure profile dir exists
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🔐 Google Sign-In for Meet Scribe Bot         ║');
  console.log('║                                                ║');
  console.log('║  A Chrome window will open.                    ║');
  console.log('║  Sign into your Google account.                ║');
  console.log('║  Then close the window or press Ctrl+C.        ║');
  console.log('║                                                ║');
  console.log('║  Your session will be saved for the bot.       ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--password-store=basic',
      '--use-mock-keychain',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2' });

  console.log('🌐 Chrome opened — sign into Google now...');
  console.log('📁 Profile will be saved to:', PROFILE_DIR);

  // Wait until the browser is closed by the user
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });

  console.log('');
  console.log('✅ Sign-in complete! Profile saved.');
  console.log('🤖 The bot will use this session to join meetings.');
  console.log('');
}

openLoginWindow().catch(console.error);

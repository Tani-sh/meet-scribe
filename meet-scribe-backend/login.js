/**
 * Login Helper — Opens Chrome for user to sign into Google once.
 * The profile is saved persistently so the bot stays authenticated.
 * 
 * Run: node login.js
 * 
 * After signing in and closing the window, commit + push the profile:
 *   git add data/chrome-profile && git commit -m "chore: refresh auth profile" && git push
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR = path.join(__dirname, 'data', 'chrome-profile');

async function openLoginWindow() {
  // Ensure profile dir exists
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🔐 Google Sign-In for Meet Scribe Bot                 ║');
  console.log('║                                                        ║');
  console.log('║  A Chrome window will open.                            ║');
  console.log('║  1. Sign into your bot\'s Google account.               ║');
  console.log('║  2. After sign-in, visit https://meet.google.com       ║');
  console.log('║     to confirm you see "New meeting" (proves login).   ║');
  console.log('║  3. Close the Chrome window when done.                 ║');
  console.log('║                                                        ║');
  console.log('║  Your authenticated session will be saved to:          ║');
  console.log(`║  ${PROFILE_DIR}`);
  console.log('╚════════════════════════════════════════════════════════╝');
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

  // Remove automation traces so Google doesn't flag the login
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Remove the Chrome automation extension registry
    delete navigator.__proto__.webdriver;
  });

  await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2' });

  console.log('🌐 Chrome opened — sign into Google now...');
  console.log('');
  console.log('💡 TIP: After signing in, navigate to https://meet.google.com');
  console.log('   to ensure the session is trusted for Meet specifically.');
  console.log('');

  // Wait until the browser is closed by the user
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });

  // Post-login verification: check if auth cookies exist now
  console.log('');
  console.log('🔍 Verifying authentication...');
  
  try {
    const sqlite3Path = path.join(PROFILE_DIR, 'Default', 'Cookies');
    if (fs.existsSync(sqlite3Path)) {
      // Quick check: see if the file was recently modified
      const stats = fs.statSync(sqlite3Path);
      const ageMinutes = (Date.now() - stats.mtimeMs) / 60000;
      if (ageMinutes < 10) {
        console.log('✅ Cookies database was updated just now — sign-in looks successful!');
      } else {
        console.log(`⚠️  Cookies file was last modified ${Math.round(ageMinutes)} minutes ago.`);
        console.log('   If you just signed in, this should be recent.');
      }
    }
  } catch (e) {
    // Non-critical check
  }

  console.log('');
  console.log('✅ Profile saved! Next steps:');
  console.log('');
  console.log('   1. Commit the refreshed profile:');
  console.log('      git add data/chrome-profile');
  console.log('      git commit -m "chore: refresh authenticated chrome profile"');
  console.log('      git push origin main');
  console.log('');
  console.log('   2. Wait for Render to rebuild, then test a meeting join.');
  console.log('');
}

openLoginWindow().catch(console.error);

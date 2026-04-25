/**
 * Google Auth Cookie Exporter
 * 
 * Uses your REAL installed Chrome (not Puppeteer's Chromium)
 * so that Google doesn't block sign-in as "insecure browser".
 *
 * Usage:
 *   node exportCookies.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Launching your real Chrome browser...');

  const browser = await puppeteer.launch({
    headless: false,
    // Use the real Chrome installation, NOT the bundled Chromium
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      // Use a fresh temporary profile so it doesn't interfere with your real Chrome
      '--user-data-dir=/tmp/bot-chrome-profile',
    ],
    ignoreDefaultArgs: ['--enable-automation'], // hide the "Chrome is being controlled" bar
  });

  const page = await browser.newPage();
  
  // Extra stealth: remove webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });

  console.log('\n===========================================');
  console.log('  Sign into your bot Google account now.');
  console.log('  (e.g. meetscribe.botT@gmail.com)');
  console.log('');
  console.log('  After you see "myaccount.google.com",');
  console.log('  come back here and press ENTER.');
  console.log('===========================================\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question('Press ENTER after signing in... ', resolve));
  rl.close();

  // Grab all cookies across Google domains
  const client = await page.target().createCDPSession();
  const { cookies } = await client.send('Network.getAllCookies');

  // Filter to only Google-related cookies
  const googleCookies = cookies.filter(c => 
    c.domain.includes('google.com') || 
    c.domain.includes('youtube.com') ||
    c.domain.includes('gstatic.com')
  );

  fs.writeFileSync('google-cookies.json', JSON.stringify(googleCookies, null, 2));
  console.log(`\n✅ Saved ${googleCookies.length} cookies to google-cookies.json`);
  console.log('\nNext steps:');
  console.log('  1. Open google-cookies.json');
  console.log('  2. Copy ALL of the contents');
  console.log('  3. Go to Render → meet-scribe-backend → Environment');
  console.log('  4. Add variable: GOOGLE_COOKIES = <paste the JSON>');
  console.log('  5. Save & trigger a manual deploy\n');

  await browser.close();
})();

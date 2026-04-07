/**
 * Google Auth Cookie Exporter
 * 
 * Run this ONCE on your local machine to sign into Google,
 * then the cookies are saved to google-cookies.json for the bot to reuse.
 *
 * Usage:
 *   node exportCookies.js
 *
 * It will open a visible Chrome window. Sign into your bot's Google account
 * (e.g. meetscribe.bot@gmail.com), then press Enter in the terminal.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Launching browser — sign into Google in the window that opens...');

  const browser = await puppeteer.launch({
    headless: false, // must be visible so you can sign in
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const page = await browser.newPage();
  await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' });

  console.log('\n===========================================');
  console.log('  Sign into your bot Google account now.');
  console.log('  After you see "myaccount.google.com",');
  console.log('  come back here and press ENTER.');
  console.log('===========================================\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question('Press ENTER after signing in... ', resolve));
  rl.close();

  // Grab all cookies from the browser
  const cookies = await page.cookies('https://accounts.google.com', 'https://myaccount.google.com', 'https://meet.google.com');

  fs.writeFileSync('google-cookies.json', JSON.stringify(cookies, null, 2));
  console.log(`\n✅ Saved ${cookies.length} cookies to google-cookies.json`);
  console.log('   Now set the GOOGLE_COOKIES env var on Render:');
  console.log('   Copy the contents of google-cookies.json and paste as the value.\n');

  await browser.close();
})();

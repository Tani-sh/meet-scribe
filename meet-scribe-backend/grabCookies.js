/**
 * Step 2: Connect to the running Chrome and grab cookies.
 * 
 * Run AFTER you've signed into the bot Google account in the Chrome
 * window that was launched by step 1.
 * 
 * Usage:
 *   node grabCookies.js
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  console.log('🔗 Connecting to Chrome on port 9222...');

  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Use CDP to get ALL cookies (not just current page)
    const client = await page.target().createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');

    // Filter to Google-related cookies
    const googleCookies = cookies.filter(c =>
      c.domain.includes('google.com') ||
      c.domain.includes('google.co') ||
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

    // Disconnect (don't close — the user's Chrome stays open)
    browser.disconnect();
  } catch (e) {
    console.error('❌ Could not connect. Make sure Chrome was launched with:');
    console.error('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\');
    console.error('     --remote-debugging-port=9222 --user-data-dir=/tmp/bot-profile');
    console.error('\nError:', e.message);
  }
})();

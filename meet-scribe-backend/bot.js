/**
 * Native Puppeteer-Stealth Bot for Google Meet
 * Uses ONLY valid Puppeteer APIs (not Playwright).
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function joinMeet(meetUrl, callbacks = {}) {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  const isServer = process.env.NODE_ENV === 'production' || process.platform === 'linux';
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  let browser;

  const emit = (type, data) => {
    if (type === 'status') onStatus?.(data);
    else if (type === 'error') onError?.(data);
    else if (type === 'transcript') onTranscript?.(data);
    console.log(`[Bot ${type.toUpperCase()}] ${data}`);
  };

  try {
    emit('status', 'launching');
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });

    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--js-flags=--max-old-space-size=256',
        '--mute-audio',
        '--window-size=1280,720',
      ],
    });
    
    // --- RAM SAVER: Kill zombie Chrome processes ---
    const cleanup = async () => {
      if (browser) {
        console.log('[Bot] Force closing browser due to process exit.');
        try { await browser.close(); } catch (e) {}
      }
      process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup); // Render sends SIGTERM when restarting/stopping

    const context = browser.defaultBrowserContext();
    // overridePermissions needs an ORIGIN, not a full URL
    await context.overridePermissions('https://meet.google.com', [
      'microphone',
      'camera',
      'notifications',
    ]);

    const page = await browser.newPage();

    // --- RAM SAVER: Block heavy resources ---
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ── Use actual Chrome version for UA (to avoid cookie/UA mismatch) ────
    const fullVersion = await browser.version(); // e.g. "HeadlessChrome/120.0.6099.109"
    const chromeVersion = fullVersion.split('/')[1] || '123.0.0.0';
    await page.setUserAgent(`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    await page.setViewport({ width: 1280, height: 720 });

    // ── Load Google session cookies (critical for cloud deployment) ───────
    let cookiesLoaded = false;
    try {
      let cookies = null;

      // Priority 1: GOOGLE_COOKIES env var (for Render)
      if (process.env.GOOGLE_COOKIES) {
        cookies = JSON.parse(process.env.GOOGLE_COOKIES);
        console.log('[Bot] Loading cookies from GOOGLE_COOKIES env var');
      }

      // Priority 2: local file (for development)
      if (!cookies) {
        const cookiePath = path.join(__dirname, 'google-cookies.json');
        if (fs.existsSync(cookiePath)) {
          cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
          console.log('[Bot] Loading cookies from google-cookies.json');
        }
      }

      if (cookies && cookies.length > 0) {
        // Must be on a google domain before setting cookies so Chrome doesn't throw them out
        await page.goto('https://google.com', { waitUntil: 'domcontentloaded' });
        await page.setCookie(...cookies);
        cookiesLoaded = true;
        console.log(`[Bot] ✅ Loaded ${cookies.length} Google session cookies`);
      } else {
        console.log('[Bot] ⚠️  No Google cookies found — joining as anonymous guest');
      }
    } catch (e) {
      console.error('[Bot] Cookie loading error:', e.message);
    }

    // ── Navigate ─────────────────────────────────────────────────────────
    emit('status', 'navigating');
    await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: 'public/debug-after-nav.png' });
    await sleep(5000); // let the SPA hydrate

    // ── Dismiss overlays ("Got it", "Dismiss", "Continue without …") ────
    await dismissByText(page, [
      'Got it',
      'Dismiss',
      'Continue without microphone and camera',
      'Continue without microphone',
    ]);

    // ── Mute mic / camera ────────────────────────────────────────────────
    await clickAriaLabel(page, 'Turn off microphone');
    await clickAriaLabel(page, 'Turn off camera');

    // ── Wait for the 'Getting ready...' spinner to finish (up to 60s) ──
    emit('status', 'waiting for Google Meet to initialize... (can take 30s)');
    
    let joined = null;
    let nameFilled = false;

    // Poll every 2 seconds for a maximum of 60 seconds (30 attempts)
    for (let attempt = 0; attempt < 30; attempt++) {
      if (!nameFilled) {
        nameFilled = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="text"]');
          for (const inp of inputs) {
            const rect = inp.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) { // headless-safe visibility
              // Use native setter to trigger React state update
              const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeValueSetter.call(inp, 'AI Notetaker');
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
          }
          return false;
        });
        if (nameFilled) {
          console.log('[Bot] Filled custom name');
          await sleep(1000); // Wait a second for React to enable the join button
        }
      }

      joined = await page.evaluate(() => {
        const els = [...document.querySelectorAll('button, span')];
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue; // skip hidden
          const txt = (el.textContent || '').trim().toLowerCase();
          const joinKeywords = ['ask to join', 'join now', 'join meeting', 'join call', 'ready to join', 'join'];
          if (joinKeywords.some(k => txt === k || (txt.includes(k) && txt.length < 25))) {
            (el.closest?.('button') || el).click();
            return txt;
          }
        }
        return null; // not found yet
      });

      if (joined) {
        console.log(`[Bot] Clicked: "${joined}"`);
        break; // Successfully clicked, exit polling loop
      }
      
      await sleep(2000); // 2 second interval
    }

    if (!joined) {
      if (nameFilled) {
        console.log('[Bot] No join button found, pressing Enter as fallback');
        await page.keyboard.press('Enter');
      } else {
        console.log('[Bot] Failed to find join button after 60 seconds. Taking screenshot...');
        await page.screenshot({ path: 'public/screenshot.png', fullPage: true });
        console.log('[Bot] Saved screenshot to public/screenshot.png');
        emit('error', 'Could not find join button. Is the Meet link valid?');
        await browser.close();
        onEnd?.();
        return;
      }
    }

    // ── Wait to be admitted ──────────────────────────────────────────────
    emit('status', 'waiting for host to admit...');
    let inCall = false;
    for (let i = 0; i < 120; i++) {
      // Check for "Leave call" button WITHOUT clicking it
      const hasLeave = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label*="Leave call"]');
        if (!btn) return false;
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (hasLeave) {
        inCall = true;
        break;
      }

      // Check for rejection
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (
        bodyText.includes("You can't join") ||
        bodyText.includes("can't join this video") ||
        bodyText.includes('denied')
      ) {
        emit('error', 'Join denied by host or meeting has ended.');
        await browser.close();
        onEnd?.();
        return;
      }

      await sleep(1000);
    }

    if (!inCall) {
      emit('error', 'Timed out waiting to be admitted (2 min).');
      await browser.close();
      onEnd?.();
      return;
    }

    // ── In-meeting ───────────────────────────────────────────────────────
    emit('status', 'listening');
    await sleep(1500);

    // Dismiss any "Got it" tooltip inside the meeting room
    await dismissByText(page, ['Got it', 'Dismiss']);

    // ── Enable captions ──────────────────────────────────────────────────
    // Method 1: keyboard shortcut 'c'
    try {
      await page.keyboard.press('c');
      await sleep(1000);
    } catch (e) {}

    // Method 2: click the CC button if captions are still off
    try {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('turn on captions') || label.includes('closed captions')) {
            if (b.getAttribute('aria-pressed') !== 'true') {
              b.click();
            }
            break;
          }
        }
      });
    } catch (e) {}

    // ── Expose callback to receive captions from the page context ────────
    await page.exposeFunction('__emitCaption', (text) => {
      emit('transcript', text);
    });

    // ── Inject caption scraper ───────────────────────────────────────────
    await page.evaluate(() => {
      let lastCaption = '';
      setInterval(() => {
        try {
          const container = document.querySelector(
            '[jsname="tgaKEf"], [data-message-text], .iTTPOb, [class*="caption"]'
          );
          if (!container || !container.innerText) return;

          const current = container.innerText.trim();
          if (!current || current === lastCaption) return;

          // Naive suffix-overlap diff
          let added = current;
          for (
            let i = Math.min(lastCaption.length, current.length);
            i > 0;
            i--
          ) {
            if (
              lastCaption.substring(lastCaption.length - i) ===
              current.substring(0, i)
            ) {
              added = current.substring(i);
              break;
            }
          }
          added = added.trim();
          if (
            added &&
            !added.includes('caption settings') &&
            !added.includes('Jump to') &&
            !added.includes('Afrikaans')
          ) {
            window.__emitCaption(added);
          }
          lastCaption = current;
        } catch (e) {}
      }, 1500);
    });

    // ── Detect meeting end / kick ────────────────────────────────────────
    const watchdog = setInterval(async () => {
      try {
        if (!browser.isConnected()) {
          clearInterval(watchdog);
          return;
        }
        const bodyText = await page.evaluate(() => document.body.innerText);
        const ended =
          bodyText.includes('You left the meeting') ||
          bodyText.includes("You've left the meeting") ||
          bodyText.includes('Return to home screen') ||
          bodyText.includes('The call ended');
        if (ended) {
          clearInterval(watchdog);
          emit('status', 'meeting_ended');
          await browser.close();
          onEnd?.();
        }
      } catch (e) {
        // page/browser might already be closed
      }
    }, 5000);

    // Hard timeout: 3 hours max
    setTimeout(async () => {
      clearInterval(watchdog);
      try {
        emit('status', 'hard timeout reached (3h)');
        await browser.close();
        onEnd?.();
      } catch (e) {}
    }, 3 * 60 * 60 * 1000);
  } catch (e) {
    emit('error', `Bot crash: ${e.message}`);
    try { if (browser) await browser.close(); } catch (_) {}
    onEnd?.();
  }
}

// ─── Helpers (pure Puppeteer, no Playwright) ─────────────────────────────────

/** Click the first visible button/span whose trimmed text matches one of the labels. */
async function dismissByText(page, labels) {
  try {
    await page.evaluate((labels) => {
      const els = [...document.querySelectorAll('button, span')];
      for (const label of labels) {
        for (const el of els) {
          const txt = (el.textContent || '').trim().toLowerCase();
          const rect = el.getBoundingClientRect();
          if (labels.some(l => txt.includes(l.toLowerCase())) && rect.width > 0 && rect.height > 0) {
            (el.closest?.('button') || el).click();
            break;
          }
        }
      }
    }, labels);
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) {}
}

/** Click a button by partial aria-label match (case-insensitive). */
async function clickAriaLabel(page, partialLabel) {
  try {
    await page.evaluate((label) => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const al = (b.getAttribute('aria-label') || '').toLowerCase();
        const rect = b.getBoundingClientRect();
        if (al.includes(label.toLowerCase()) && rect.width > 0 && rect.height > 0) {
          b.click();
          break;
        }
      }
    }, partialLabel);
    await new Promise((r) => setTimeout(r, 300));
  } catch (e) {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { joinMeet };

/**
 * Native Puppeteer-Stealth Bot for Google Meet
 * Uses ONLY valid Puppeteer APIs (not Playwright).
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function joinMeet(meetUrl, callbacks = {}) {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  // Use headful if DISPLAY is set (Xvfb on Render) — avoids headless detection heuristics
  const hasDisplay = !!process.env.DISPLAY;
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
      // Run headful when a virtual display is available (Xvfb on Render)
      // Headful mode bypasses Google's headless detection heuristics
      headless: hasDisplay ? false : 'new',
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        // Critical evasion: disable the AutomationControlled flag that Google detects
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--js-flags=--max-old-space-size=256',
        '--mute-audio',
        // Realistic 1080p viewport — 0x0 or tiny sizes are instant bot flags
        '--window-size=1920,1080',
      ],
    });
    console.log(`[Bot] Browser launched in ${hasDisplay ? 'headful (Xvfb virtual display)' : 'headless'} mode.`);
    
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
      if (['image', 'font', 'media'].includes(resourceType)) {
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
    
    await page.setViewport({ width: 1920, height: 1080 });

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
          const txt = (el.textContent || '').trim().toLowerCase();
          
          if (rect.width === 0 || rect.height === 0) {
            // Detailed log for potential button layout issues
            if (txt.includes('join') || txt.includes('ask')) {
              console.log(`[Bot DEBUG] Found candidate "${txt}" but it is invisible (0x0).`);
            }
            continue;
          }
          
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

    // ── Expose callbacks to receive captions and flush events ────────────
    await page.exposeFunction('__emitCaption', (text) => {
      emit('transcript', text);
    });

    // ── Inject MutationObserver caption scraper ───────────────────────────
    // Uses the MutationObserver API (not deprecated setInterval polling).
    // Implements stateful deduplication to handle Google Meet's real-time
    // caption refinement and a Flush+Clear pattern to prevent memory leaks.
    await page.evaluate(() => {
      // --- State management ---
      let speakerBuffer = {};   // { speakerName: latestText } — collapses refinements
      let finalizedLog = [];    // finalized segments ready to flush
      let lastSpeaker = null;

      const BLOCKLIST = ['caption settings', 'jump to', 'afrikaans'];

      // Locate the caption root — stable selector chain
      const getCaptionRoot = () =>
        document.querySelector('[jsname="tgaKEf"], [data-message-text], .iTTPOb, [class*="caption"]');

      // Deduplicate: collapse Google's real-time refinements per speaker
      const handleMutation = () => {
        const root = getCaptionRoot();
        if (!root) return;

        // Google Meet renders each speaker in a separate container row
        // Try to get speaker name + text; fall back to raw text
        const speakerEl = root.querySelector('[class*="speaker"], [class*="name"], [jsname="r4nke"]');
        const speaker = speakerEl ? speakerEl.innerText.trim() : 'Speaker';
        const fullText = root.innerText.trim();
        const text = fullText.replace(speakerEl?.innerText || '', '').trim();

        if (!text || BLOCKLIST.some(b => text.toLowerCase().includes(b))) return;

        // Speaker changed: finalize previous speaker's buffer
        if (lastSpeaker && lastSpeaker !== speaker && speakerBuffer[lastSpeaker]) {
          finalizedLog.push({ speaker: lastSpeaker, text: speakerBuffer[lastSpeaker] });
          delete speakerBuffer[lastSpeaker];
        }

        // Update the rolling buffer for the current speaker (collapses refinements)
        speakerBuffer[speaker] = text;
        lastSpeaker = speaker;
      };

      // Flush finalized segments to the Node.js backend every 15 seconds
      // This prevents the browser tab from accumulating unbounded memory
      setInterval(() => {
        // Finalize current speaker's buffer before flushing
        if (lastSpeaker && speakerBuffer[lastSpeaker]) {
          finalizedLog.push({ speaker: lastSpeaker, text: speakerBuffer[lastSpeaker] });
          delete speakerBuffer[lastSpeaker];
          lastSpeaker = null;
        }

        if (finalizedLog.length === 0) return;

        // Emit each finalized segment and clear memory
        for (const segment of finalizedLog) {
          const line = `${segment.speaker}: ${segment.text}`;
          window.__emitCaption(line);
        }
        finalizedLog = []; // Clear browser memory
      }, 15000);

      // Attach MutationObserver — fires instantly on DOM changes, no polling needed
      const observer = new MutationObserver(handleMutation);

      // Poll for caption root (it may not exist until captions are enabled)
      const attachObserver = setInterval(() => {
        const root = getCaptionRoot();
        if (root) {
          observer.observe(root, {
            childList: true,
            characterData: true,
            subtree: true,
          });
          clearInterval(attachObserver);
          console.log('[Bot] MutationObserver attached to caption container.');
        }
      }, 2000);
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

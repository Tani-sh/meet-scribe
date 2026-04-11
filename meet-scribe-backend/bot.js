/**
 * Native Puppeteer-Stealth Bot for Google Meet
 * Compatible with Puppeteer v24+ / Chrome 115+
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

async function joinMeet(meetUrl, callbacks = {}, sessionId = 'default') {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  // On Render/Linux: use headful if DISPLAY is set (Xvfb).
  // On Mac / true headless: use headless: true (NOT 'new' — deprecated in Puppeteer v24)
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
    if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });

    const debugPath = `public/debug-${sessionId}.png`;

    browser = await puppeteer.launch({
      // Mount the authenticated Chrome profile to bypass Google's login wall
      userDataDir: path.join(__dirname, 'data', 'chrome-profile'),

      // FIX 1: headless: true is correct for Puppeteer v24 / Chrome 115+
      // 'new' was a transitional flag that is now deprecated/removed
      headless: hasDisplay ? false : true,

      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // FIX 2: Fake media streams so mic/camera "work" without real hardware
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        // FIX 3: Keep GPU disabled for server compat but allow SW rendering
        '--disable-gpu',
        '--disable-software-rasterizer',
        // Prevent Google's bot-detection from seeing the automation flag
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--js-flags=--max-old-space-size=512',
        '--mute-audio',
        // Realistic 1080p viewport
        '--window-size=1920,1080',
        // Allow autoplay (needed for Meet's audio/video)
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    console.log(`[Bot] Browser launched in ${hasDisplay ? 'headful (Xvfb)' : 'headless'} mode.`);

    // Cleanup on process exit
    const cleanup = async () => {
      if (browser) {
        console.log('[Bot] Force closing browser due to process exit.');
        try { await browser.close(); } catch (e) {}
      }
      process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Override mic/camera permissions at the origin level
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', [
      'microphone',
      'camera',
      'notifications',
    ]);

    const page = await browser.newPage();

    // FIX 4: Do NOT block 'image' resources — Google Meet's lobby UI
    // requires image resources for critical CSS background / avatar loading.
    // Only block true media/font files that are never needed.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      // Only block heavy binary fonts and raw media (video chunks)
      if (type === 'font' || type === 'media') {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Use the actual Chrome version for the User-Agent (must match cookies)
    const fullVersion = await browser.version(); // e.g. "Chrome/146.0.7680.153"
    const chromeVersion = fullVersion.split('/')[1] || '146.0.0.0';
    await page.setUserAgent(
      `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the Meet URL
    emit('status', 'navigating');
    await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the SPA to fully hydrate (especially slow on low-RAM servers)
    await sleep(8000);
    await page.screenshot({ path: debugPath });

    // Dismiss common overlays before trying to join
    await dismissByText(page, [
      'Got it',
      'Dismiss',
      'Continue without microphone and camera',
      'Continue without microphone',
      'OK',
    ]);

    // Turn off mic & camera in the lobby (reduce bot fingerprint)
    await clickAriaLabel(page, 'Turn off microphone');
    await sleep(300);
    await clickAriaLabel(page, 'Turn off camera');
    await sleep(300);

    // ── Wait for "Getting ready..." / join lobby (up to 90 seconds) ──────────
    emit('status', 'waiting for lobby to load...');

    let joined = null;
    let nameFilled = false;

    for (let attempt = 0; attempt < 45; attempt++) {
      // Step 1: Fill in name if there's a name input (guest/pre-join screen)
      if (!nameFilled) {
        nameFilled = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="text"], input[aria-label*="name"], input[placeholder*="name"]');
          for (const inp of inputs) {
            const rect = inp.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeValueSetter.call(inp, 'AI Notetaker');
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
          return false;
        });
        if (nameFilled) {
          console.log('[Bot] Filled name field');
          await sleep(1200);
        }
      }

      // Step 2: Try to click the join button using multiple detection strategies
      joined = await page.evaluate(() => {
        // Strategy A: Partial aria-label match (most reliable for new Meet UI)
        const ariaTargets = [
          'ask to join',
          'join now',
          'join meeting',
          'join call',
          'request to join',
          'join'
        ];
        const allClickable = [...document.querySelectorAll('button, [role="button"]')];
        for (const label of ariaTargets) {
          for (const btn of allClickable) {
            const btnAria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (btnAria === label || (btnAria.includes(label) && btnAria.length < 30)) {
              if (btn.getBoundingClientRect().width > 0) {
                btn.click();
                return label;
              }
            }
          }
        }

        // Strategy B: Text content scan (fallback for older/transitional UI)
        for (const el of allClickable) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const txt = (el.textContent || '').trim().toLowerCase();
          if (ariaTargets.some(k => txt === k || (txt.includes(k) && txt.length < 30))) {
            el.click();
            return txt;
          }
        }

        // Strategy C: Span inside button (for Material Design / MUI buttons)
        const spans = [...document.querySelectorAll('span')];
        for (const span of spans) {
          const txt = (span.textContent || '').trim().toLowerCase();
          if (ariaTargets.includes(txt)) {
            const btn = span.closest('button') || span.closest('[role="button"]');
            if (btn && btn.getBoundingClientRect().width > 0) {
              btn.click();
              return txt + ' (via span)';
            }
          }
        }

        return null;
      });

      if (joined) {
        console.log(`[Bot] Clicked join: "${joined}"`);
        await sleep(2000);
        await page.screenshot({ path: debugPath });
        break;
      }

      // Log progress every 10 seconds
      if (attempt % 5 === 0) {
        const snapshot = await page.evaluate(() => {
          return [...document.querySelectorAll('button, [role="button"]')]
            .map(el => ({
              text: (el.textContent || '').trim().substring(0, 40),
              ariaLabel: el.getAttribute('aria-label') || '',
              visible: el.getBoundingClientRect().width > 0,
            }))
            .filter(b => (b.text || b.ariaLabel) && b.visible)
            .slice(0, 8);
        });
        console.log(`[Bot] Attempt ${attempt}: visible buttons =`, JSON.stringify(snapshot));
      }

      await sleep(2000);
    }

    if (!joined) {
      // Capture full debug info before giving up
      const allButtons = await page.evaluate(() =>
        [...document.querySelectorAll('button, [role="button"], span')].map(el => ({
          text: (el.textContent || '').trim().substring(0, 60),
          ariaLabel: el.getAttribute('aria-label') || '',
          visible: el.getBoundingClientRect().width > 0,
        })).filter(b => (b.text || b.ariaLabel) && b.visible)
      );
      console.log('[Bot DEBUG] All visible interactive elements:', JSON.stringify(allButtons));

      // Fallback: press Enter regardless of whether we logged in or filled a name.
      // Pressing enter on the lobby often invokes the primary action (Join)
      console.log('[Bot] Pressing Enter as last-resort join attempt');
      await page.keyboard.press('Enter');
      await sleep(4000);
      await page.screenshot({ path: debugPath });
      
      const hasLeaveBtn = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label*="Leave"], button[aria-label*="leave"]');
        return !!(btn && btn.getBoundingClientRect().width > 0);
      });
      
      if (!hasLeaveBtn) {
        await page.screenshot({ path: debugPath, fullPage: true });
        emit('error', `Could not find join button. Bot sees: ${allButtons.slice(0, 3).map(b => b.ariaLabel || b.text).join(', ')}`);
        await browser.close();
        onEnd?.();
        return;
      }
      joined = 'Enter key fallback';
    }

    // ── Wait to be admitted (up to 3 min) ────────────────────────────────────
    emit('status', 'waiting for host to admit...');
    let inCall = false;

    for (let i = 0; i < 180; i++) {
      // Check for "Leave call" button — reliable indicator that we're inside
      const hasLeave = await page.evaluate(() => {
        const btn = document.querySelector(
          'button[aria-label*="Leave"], button[aria-label*="leave call"], button[aria-label*="Leave call"]'
        );
        if (!btn) return false;
        return btn.getBoundingClientRect().width > 0;
      });
      if (hasLeave) { inCall = true; break; }

      // Detect rejection / expired meeting
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      if (
        bodyText.includes("You can't join") ||
        bodyText.includes("can't join this video") ||
        bodyText.includes('denied') ||
        bodyText.includes('Invalid video call name') ||
        bodyText.includes('No one else is here')
      ) {
        emit('error', 'Join denied by host or meeting has ended / is invalid.');
        await browser.close();
        onEnd?.();
        return;
      }

      await sleep(1000);
    }

    if (!inCall) {
      emit('error', 'Timed out waiting to be admitted (3 min).');
      await browser.close();
      onEnd?.();
      return;
    }

    // ── In-meeting ────────────────────────────────────────────────────────────
    emit('status', 'listening');
    await sleep(2000);

    // Dismiss any "Got it" tooltip inside the meeting
    await dismissByText(page, ['Got it', 'Dismiss', 'OK']);

    // ── Enable captions ───────────────────────────────────────────────────────
    // Method 1: keyboard shortcut 'c'
    try { await page.keyboard.press('c'); await sleep(800); } catch (_) {}

    // Method 2: Click CC button if still off
    try {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, [role="button"]')];
        for (const b of btns) {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          if (
            (label.includes('turn on captions') || label.includes('closed captions') || label.includes('caption')) &&
            b.getAttribute('aria-pressed') !== 'true'
          ) {
            b.click();
            break;
          }
        }
      });
    } catch (_) {}

    // ── Expose the transcript callback to browser context ─────────────────────
    await page.exposeFunction('__emitCaption', (text) => emit('transcript', text));

    // ── Inject MutationObserver caption scraper ───────────────────────────────
    await page.evaluate(() => {
      let speakerBuffer = {};
      let finalizedLog = [];
      let lastSpeaker = null;

      const BLOCKLIST = ['caption settings', 'jump to', 'afrikaans', 'turn on'];

      const getCaptionRoot = () =>
        document.querySelector('[jsname="tgaKEf"], [data-message-text], .iTTPOb, [class*="caption"]');

      const handleMutation = () => {
        const root = getCaptionRoot();
        if (!root) return;

        const speakerEl = root.querySelector('[class*="speaker"], [class*="name"], [jsname="r4nke"]');
        const speaker = speakerEl ? speakerEl.innerText.trim() : 'Speaker';
        const fullText = root.innerText.trim();
        const text = fullText.replace(speakerEl?.innerText || '', '').trim();

        if (!text || BLOCKLIST.some(b => text.toLowerCase().includes(b))) return;

        if (lastSpeaker && lastSpeaker !== speaker && speakerBuffer[lastSpeaker]) {
          finalizedLog.push({ speaker: lastSpeaker, text: speakerBuffer[lastSpeaker] });
          delete speakerBuffer[lastSpeaker];
        }

        speakerBuffer[speaker] = text;
        lastSpeaker = speaker;
      };

      // Flush to Node.js every 15 seconds
      setInterval(() => {
        if (lastSpeaker && speakerBuffer[lastSpeaker]) {
          finalizedLog.push({ speaker: lastSpeaker, text: speakerBuffer[lastSpeaker] });
          delete speakerBuffer[lastSpeaker];
          lastSpeaker = null;
        }
        if (finalizedLog.length === 0) return;
        for (const segment of finalizedLog) {
          window.__emitCaption(`${segment.speaker}: ${segment.text}`);
        }
        finalizedLog = [];
      }, 15000);

      // Attach MutationObserver (polls until caption root appears)
      const observer = new MutationObserver(handleMutation);
      const attachObserver = setInterval(() => {
        const root = getCaptionRoot();
        if (root) {
          observer.observe(root, { childList: true, characterData: true, subtree: true });
          clearInterval(attachObserver);
          console.log('[Bot] MutationObserver attached to caption root.');
        }
      }, 2000);
    });

    // ── Detect meeting end / kick ─────────────────────────────────────────────
    const watchdog = setInterval(async () => {
      try {
        if (!browser.isConnected()) { clearInterval(watchdog); return; }
        const bodyText = await page.evaluate(() => document.body?.innerText || '');
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
      } catch (_) {}
    }, 5000);

    // Hard timeout: 3 hours max
    setTimeout(async () => {
      clearInterval(watchdog);
      try {
        emit('status', 'hard timeout reached (3h)');
        await browser.close();
        onEnd?.();
      } catch (_) {}
    }, 3 * 60 * 60 * 1000);

  } catch (e) {
    emit('error', `Bot crash: ${e.message}`);
    try { if (browser) await browser.close(); } catch (_) {}
    onEnd?.();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Click the first visible button/span whose trimmed text matches any of the labels. */
async function dismissByText(page, labels) {
  try {
    await page.evaluate((labels) => {
      const els = [...document.querySelectorAll('button, [role="button"], span')];
      for (const el of els) {
        const txt = (el.textContent || '').trim().toLowerCase();
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && labels.some(l => txt.includes(l.toLowerCase()))) {
          (el.closest('button') || el.closest('[role="button"]') || el).click();
          break;
        }
      }
    }, labels);
    await sleep(500);
  } catch (_) {}
}

/** Click a button by partial aria-label match (case-insensitive). */
async function clickAriaLabel(page, partialLabel) {
  try {
    await page.evaluate((label) => {
      const btns = [...document.querySelectorAll('button, [role="button"]')];
      for (const b of btns) {
        const al = (b.getAttribute('aria-label') || '').toLowerCase();
        const rect = b.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && al.includes(label.toLowerCase())) {
          b.click();
          break;
        }
      }
    }, partialLabel);
    await sleep(300);
  } catch (_) {}
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { joinMeet };

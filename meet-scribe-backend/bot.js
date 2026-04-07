/**
 * Native Puppeteer Bot for Google Meet
 * Replaces the unstable Python Selenium architecture.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function joinMeet(meetUrl, callbacks = {}) {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  const isServer = process.env.NODE_ENV === 'production' || process.platform === 'linux';
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  let browser;

  const emit = (type, data) => {
    if (type === 'status') onStatus?.(data);
    else if (type === 'error') onError?.(data);
    else if (type === 'transcript') onTranscript?.(data);
    console.log(`[Puppeteer ${type.toUpperCase()}] ${data}`);
  };

  try {
    emit('status', 'launching browser natively...');
    
    browser = await puppeteer.launch({
      headless: isServer ? 'new' : false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--disable-extensions',
        '--js-flags=--max-old-space-size=256',
        '--mute-audio',
        '--window-size=1280,720'
      ]
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetUrl, ['microphone', 'camera', 'notifications']);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    emit('status', 'navigating');
    await page.goto(meetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for initial load
    await new Promise(r => setTimeout(r, 4000));

    // Handle "Got it", "Dismiss", and "Continue without microphone"
    await clickIfVisible(page, 'button:has-text("Got it")');
    await clickIfVisible(page, 'button:has-text("Dismiss")');
    await clickIfVisible(page, 'button:has-text("Continue without microphone")');

    // Mute mic/camera if visible
    await clickIfVisible(page, 'button[aria-label*="Turn off microphone"]');
    await clickIfVisible(page, 'button[aria-label*="Turn off camera"]');

    // Fill Name
    emit('status', 'filling name');
    const nameInputs = await page.$$('input[type="text"]');
    let nameFilled = false;
    for (const inp of nameInputs) {
        if (await inp.isVisible()) {
            // clear and type
            await inp.click();
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await inp.type("AI Notetaker", { delay: 50 });
            nameFilled = true;
            break;
        }
    }

    await new Promise(r => setTimeout(r, 1500));

    // Join / Ask to Join
    emit('status', 'joining');
    let joined = false;
    const possibleTexts = ["Join now", "Ask to join", "Join meeting", "Join", "Continue", "Continue to join"];
    
    for (const text of possibleTexts) {
        const btn = page.locator(`button:has-text("${text}"), span:has-text("${text}")`).first();
        try {
            if (await clickIfVisible(page, `button:has-text("${text}"), span:has-text("${text}")`, 2000)) {
                joined = true;
                break;
            }
        } catch(e) {}
    }

    if (!joined && nameFilled) {
        console.log("No visible join button, trying Enter fallback");
        await page.keyboard.press('Enter');
        joined = true;
    }

    if (!joined) {
        emit('error', "Could not find join button. Is the Meet link fully loaded?");
        await browser.close();
        onEnd?.();
        return;
    }

    emit('status', 'waiting for host to admit...');
    
    // Wait until admitted (e.g. Leave Call button appears)
    let inCall = false;
    for (let i = 0; i < 90; i++) {
        if (await clickIfVisible(page, 'button[aria-label*="Leave call"]', 500)) {
            // we found leave call button to click? No we don't want to click it. We just want to check if it exists!
        }
        // actually just wait for selector
        const leaveBtn = await page.$('button[aria-label*="Leave call"]');
        if (leaveBtn) {
            inCall = true;
            break;
        }
        
        // Also check if rejected
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes("You can't join") || pageText.includes("denied")) {
             emit('error', "Join denied by host or meeting ended.");
             await browser.close();
             onEnd?.();
             return;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!inCall) {
        emit('error', "Timed out waiting to be admitted.");
        await browser.close();
        onEnd?.();
        return;
    }

    emit('status', 'listening');

    // Dismiss tooltips inside meeting
    await clickIfVisible(page, 'button:has-text("Got it")');

    // Enable Captions
    try {
        await page.keyboard.press('c'); // shortcut
        await new Promise(r => setTimeout(r, 1000));
        
        // also try button to be sure
        const ccBtn = await page.$('button[aria-label*="Turn on captions"]');
        if (ccBtn && await ccBtn.isVisible()) {
            await ccBtn.click();
        }
    } catch(e) {}

    // Expose Node function to receive captions
    await page.exposeFunction('emitCaption', (text) => {
        emit('transcript', text);
    });

    // Injected polling loop for DOM caption reading natively
    await page.evaluate(() => {
        window.lastCaption = "";
        setInterval(() => {
            try {
                let container = document.querySelector('.iOzk7, .VbkSUe, .a4cQT, [class*="caption"]');
                if (container && container.innerText) {
                    let current = container.innerText.trim();
                    if (current && current !== window.lastCaption) {
                        // Very naive suffix diffing
                        let added = current;
                        for (let i = Math.min(window.lastCaption.length, current.length); i > 0; i--) {
                            if (window.lastCaption.substring(window.lastCaption.length - i) === current.substring(0, i)) {
                                added = current.substring(i);
                                break;
                            }
                        }
                        added = added.trim();
                        if (added && !added.includes("caption settings") && !added.includes("Jump to")) {
                            window.emitCaption(added);
                        }
                        window.lastCaption = current;
                    }
                }
            } catch(e){}
        }, 1500);
    });

    // Detect hangup/kick
    const checkInterval = setInterval(async () => {
        try {
            if (browser && !browser.isConnected()) return clearInterval(checkInterval);
            const body = await page.evaluate(() => document.body.innerText);
            if (body.includes("You left the meeting") || body.includes("Return to home screen") || body.includes("You've left the meeting")) {
                emit('status', 'meeting ended organically');
                clearInterval(checkInterval);
                await browser.close();
                onEnd?.();
            }
        } catch(e) {}
    }, 5000);

  } catch(e) {
    emit('error', `Puppeteer Launch Error: ${e.message}`);
    if (browser) await browser.close();
    onEnd?.();
  }
}

// helper to click a selector if it is visible
async function clickIfVisible(page, selector, timeout = 3000) {
    try {
        const el = await page.waitForSelector(selector, { state: 'visible', timeout });
        if (el) {
            await el.click();
            return true;
        }
    } catch (err) {
        return false;
    }
}

module.exports = { joinMeet };

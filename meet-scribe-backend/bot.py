import sys
import time
import json
import argparse
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import os

def emit(type, data):
    print(json.dumps({"type": type, "data": data}))
    sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    args = parser.parse_args()

    emit("status", "launching")

    profile_dir = os.path.join(os.getcwd(), "data", "python-chrome-profile")
    os.makedirs(profile_dir, exist_ok=True)

    # Remove stale locks that cause 'chrome not reachable'
    for lock in ["SingletonLock", "SingletonSocket", "SingletonCookie"]:
        lock_path = os.path.join(profile_dir, lock)
        if os.path.exists(lock_path):
            try:
                if os.path.isdir(lock_path) and not os.path.islink(lock_path):
                    import shutil
                    shutil.rmtree(lock_path)
                else:
                    os.remove(lock_path)
            except: pass

    import platform
    is_server = platform.system() == "Linux" or os.environ.get('NODE_ENV') == 'production'

    options = uc.ChromeOptions()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-notifications")
    options.add_argument("--mute-audio")
    options.add_argument("--use-fake-ui-for-media-stream")
    options.add_argument("--use-fake-device-for-media-stream")
    
    if is_server:
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")

    prefs = {
        "profile.default_content_setting_values.media_stream_mic": 1,
        "profile.default_content_setting_values.media_stream_camera": 1,
        "profile.default_content_setting_values.geolocation": 2,
        "profile.default_content_setting_values.notifications": 2
    }
    options.add_experimental_option("prefs", prefs)
    
    # Determine Chrome/Chromium executable path dynamically
    chrome_path = os.environ.get('PUPPETEER_EXECUTABLE_PATH')
    if not chrome_path:
        system = platform.system()
        if system == "Darwin":
            chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        elif system == "Windows":
            chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        else:
            chrome_path = "/usr/bin/chromium"

    version_main = 146
    try:
        import subprocess, re
        cmd_path = chrome_path if chrome_path else "google-chrome"
        output = subprocess.check_output([cmd_path, '--version']).decode('utf-8')
        match = re.search(r'(\d+)', output)
        if match:
            version_main = int(match.group(1))
    except Exception:
        pass

    try:
        driver = uc.Chrome(
            options=options, 
            user_data_dir=profile_dir,
            browser_executable_path=chrome_path,
            version_main=version_main,
            headless=is_server
        )
    except Exception as e:
        emit("error", f"Chrome launch failed: {str(e)}")
        sys.exit(1)

    driver.set_window_size(1280, 720)

    try:
        driver.get('https://myaccount.google.com/')
        emit("status", "navigating")
        time.sleep(3)

        if "accounts.google.com" in driver.current_url or "signin" in driver.current_url.lower():
            emit("status", "waiting-for-signin")
            # Wait up to 60s
            for _ in range(60):
                if driver.current_url.startswith("https://myaccount.google.com"):
                    break
                time.sleep(1)
            else:
                emit("status", "Proceeding anonymously to meeting...")

        # Nav to meet link
        emit("status", "joining")
        driver.get(args.url)
        time.sleep(6)

        page_text = driver.execute_script('return document.body.innerText')
        if "You can\'t join" in page_text or "can\'t join this video" in page_text:
            emit("error", "Can't join this meeting. The host may need to admit you, or it ended.")
            driver.quit()
            sys.exit(1)

        # Dismiss popups
        try:
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for btn in buttons:
                txt = btn.text.strip().lower()
                if "dismiss" in txt or "got it" in txt or "accept" in txt or "i agree" in txt:
                    try:
                        btn.click()
                        time.sleep(1)
                    except: pass
        except: pass

        # Enter name if available
        try:
            inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="text"]')
            for inp in inputs:
                if inp.is_displayed():
                    inp.send_keys("AI Notetaker")
                    break
        except: pass

        time.sleep(1)

        # Mute mic/camera if available
        try:
            for label in ['Turn off microphone', 'Turn off camera', 'camera', 'microphone']:
                els = driver.find_elements(By.CSS_SELECTOR, f'[aria-label*="{label}"]')
                for el in els:
                    if el.is_displayed():
                        driver.execute_script("arguments[0].click();", el)
                        time.sleep(0.5)
        except: pass

        # Join button
        joined = False
        try:
            # Look for ANY span on the screen that contains Join text
            spans = driver.find_elements(By.XPATH, "//span[contains(text(), 'Ask to join') or contains(text(), 'Join now') or contains(text(), 'Join')]")
            for span in spans:
                if span.is_displayed():
                    driver.execute_script("arguments[0].click();", span)
                    joined = True
                    break
        except: pass

        if not joined:
            try:
                # Explicit JS fallback for the main join button
                btn = driver.find_elements(By.CSS_SELECTOR, 'button[jsname="Qx7uuf"], button[class*="join"]')
                if btn:
                    driver.execute_script("arguments[0].click();", btn[0])
                    joined = True
            except: pass

        if not joined:
            page_text = driver.execute_script("return document.body.innerText")
            if "Sign in" in page_text and "to join" in page_text:
                emit("error", "Join failed: Your meeting link does not allow Anonymous Guests. You must either use a personal @gmail.com meeting, or create a throwaway Google Account named 'AI Notetaker' and sign into it during the 60s wait window.")
            else:
                emit("error", "Could not find join button. Is the Meet link fully loaded?")
            driver.quit()
            sys.exit(1)

        emit("status", "waiting for host to admit...")
        admitted = False
        for _ in range(120):
            try:
                if driver.find_elements(By.CSS_SELECTOR, '[aria-label*="Leave call"]'):
                    admitted = True
                    break
            except: pass
            time.sleep(1)

        if not admitted:
            emit("error", "Host did not admit the bot in time.")
            driver.quit()
            sys.exit(1)

        time.sleep(1) # Reduced from 3 to instantly trigger CC
        
        # Aggressively dismiss any "Welcome to Meet" or "Got it" tooltips inside the room
        try:
            for btn in driver.find_elements(By.TAG_NAME, "button"):
                if not btn.is_displayed(): continue
                txt = btn.text.strip().lower()
                if "dismiss" in txt or "got it" in txt or "accept" in txt or "continue" in txt:
                    try:
                        driver.execute_script("arguments[0].click();", btn)
                    except: pass
        except: pass

        emit("status", "listening")

        # Captions
        try:
            body = driver.find_element(By.TAG_NAME, "body")
            body.send_keys('c')
            time.sleep(0.5)
        except: pass

        # Explicitly turn on CC if off (Check aria-pressed to prevent double toggling)
        try:
            btns = driver.find_elements(By.CSS_SELECTOR, 'button[aria-label*="caption" i], button[data-tooltip*="caption" i]')
            for btn in btns:
                if btn.is_displayed():
                    if btn.get_attribute("aria-pressed") == "false":
                        driver.execute_script("arguments[0].click();", btn)
                    time.sleep(0.5)
                    break
        except: pass

        # Inject robust JS caption scraper
        driver.execute_script("""
            window.latestCaptions = "";
            setInterval(() => {
                try {
                    // Try targeting generic aria-live containers
                    let container = document.querySelector('.iOzk7, .VbkSUe, .a4cQT, [class*="caption"]');
                    if (container && container.innerText) {
                        window.latestCaptions = container.innerText.trim();
                    }
                } catch(e){}
            }, 1000);
        """)
        
        last_raw_caption = ""
        idle_count = 0

        while True:
            time.sleep(1)
            found = ""
            try:
                found = driver.execute_script("return window.latestCaptions;")
            except: pass
            
            if found and found != last_raw_caption:
                # Mathematical diff finding suffix overlaps
                added = found
                for i in range(min(len(last_raw_caption), len(found)), 0, -1):
                    if last_raw_caption[-i:] == found[:i]:
                        added = found[i:]
                        break
                
                added = added.strip()
                if added and "caption settings" not in added and "Jump to" not in added and "Afrikaans" not in added:
                    clean_lines = " ".join([l.strip() for l in added.splitlines() if l.strip()])
                    emit("transcript", clean_lines)
                    idle_count = 0
                
                last_raw_caption = found
            else:
                idle_count += 1
            
            # Check if meeting ended (end screen detection)
            if idle_count % 5 == 0:
                try:
                    page_text = driver.execute_script('return document.body.innerText')
                    if "Return to home screen" in page_text or "You left the meeting" in page_text or "You've left the meeting" in page_text:
                        break
                except: pass

            if "meet.google.com" not in driver.current_url or "landing" in driver.current_url or idle_count > 180:
                break
                
    except Exception as e:
        emit("error", str(e))
    finally:
        driver.quit()

if __name__ == "__main__":
    main()

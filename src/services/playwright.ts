/*
 * File: playwright.ts
 * Project: QwenBridge
 *
 * Playwright browser automation with stealth plugin for anti-bot evasion.
 * Captures real browser headers (bx-ua, bx-umidtoken) per account.
 */

import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import crypto from "crypto";
import { QwenAccount } from "../core/accounts.ts";
import { config } from "../core/config.ts";
import { logger } from "../core/logger.ts";

// Try to import playwright-extra and stealth, fallback to regular playwright
let chromiumWithStealth: typeof chromium | null = null;

try {
  const pwExtra = await import("playwright-extra");
  const stealth = await import("puppeteer-extra-plugin-stealth");

  if (pwExtra.chromium && stealth.default) {
    const plugin = stealth.default();
    pwExtra.chromium.use(plugin);
    chromiumWithStealth = pwExtra.chromium;
    logger.info("[Playwright] Stealth plugin loaded");
  }
} catch {
  logger.warn(
    "[Playwright] playwright-extra/stealth not available, using regular playwright",
  );
}

export type BrowserType = "chromium" | "chrome" | "edge";

interface BrowserEngineConfig {
  engine: typeof chromium;
  channel?: string;
}

function resolveBrowserEngine(browserType: BrowserType): BrowserEngineConfig {
  switch (browserType) {
    case "chrome":
      return { engine: chromium, channel: "chrome" };
    case "edge":
      return { engine: chromium, channel: "msedge" };
    case "chromium":
    default:
      return { engine: chromium };
  }
}

// ─── Mutex ────────────────────────────────────────────────────────────────────

class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

// Per-account mutexes for browser access
const accountMutexes = new Map<string, Mutex>();

function getAccountMutex(accountId: string): Mutex {
  let mutex = accountMutexes.get(accountId);
  if (!mutex) {
    mutex = new Mutex();
    accountMutexes.set(accountId, mutex);
  }
  return mutex;
}

// ─── State ────────────────────────────────────────────────────────────────────

// Per-account browser contexts and pages
const accountContexts = new Map<string, BrowserContext>();
const accountPages = new Map<string, Page>();

// Header cache per account
interface AccountHeaderCache {
  headers: Record<string, string>;
  lastRefresh: number;
  refreshInProgress: boolean;
}

const headerCaches = new Map<string, AccountHeaderCache>();
const HEADER_CACHE_TTL = 50 * 60 * 1000; // 50 minutes
const COOKIE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cookieCaches = new Map<string, { cookie: string; timestamp: number }>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getHeaderCache(accountId: string): AccountHeaderCache {
  let cache = headerCaches.get(accountId);
  if (!cache) {
    cache = {
      headers: {},
      lastRefresh: 0,
      refreshInProgress: false,
    };
    headerCaches.set(accountId, cache);
  }
  return cache;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCookies(accountId: string): Promise<string> {
  const now = Date.now();
  const cached = cookieCaches.get(accountId);
  if (cached && now - cached.timestamp < COOKIE_CACHE_TTL) {
    return cached.cookie;
  }

  const page = accountPages.get(accountId);
  if (!page) return "";

  const cookies = await page.context().cookies();
  const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  cookieCaches.set(accountId, { cookie: cookieStr, timestamp: now });
  return cookieStr;
}

export async function getBasicHeaders(accountId: string): Promise<{
  cookie: string;
  userAgent: string;
  bxV: string;
  bxUa: string;
  bxUmidtoken: string;
}> {
  const page = accountPages.get(accountId);
  if (!page) {
    throw new Error(`Playwright not initialized for account: ${accountId}`);
  }

  // Acquire mutex to prevent concurrent browser access
  const release = await getAccountMutex(accountId).acquire();
  try {
    const cookie = await getCookies(accountId);
    const cache = getHeaderCache(accountId);

    // Get real user agent from browser
    let userAgent = config.auth.userAgent;
    try {
      userAgent = await page.evaluate(() => navigator.userAgent);
    } catch {
      // Use default
    }

    // Refresh headers if stale
    const headersAge = Date.now() - cache.lastRefresh;
    if (headersAge > HEADER_CACHE_TTL && !cache.refreshInProgress) {
      await refreshHeadersInternal(accountId);
    }

    return {
      cookie,
      userAgent,
      bxV: cache.headers["bx-v"] || "2.5.36",
      bxUa: cache.headers["bx-ua"] || "",
      bxUmidtoken: cache.headers["bx-umidtoken"] || "",
    };
  } finally {
    release();
  }
}

export async function initPlaywrightForAccount(
  account: QwenAccount,
  headless = true,
  browserType: BrowserType = "chromium",
): Promise<void> {
  if (accountPages.has(account.id)) {
    console.log(`[Playwright] Already initialized for ${account.email}`);
    return;
  }

  const release = await getAccountMutex(account.id).acquire();
  try {
    // Double-check after acquiring lock
    if (accountPages.has(account.id)) {
      console.log(`[Playwright] Already initialized for ${account.email}`);
      return;
    }

    const profilePath = path.resolve("data", "qwen_profiles", account.id);
    const { engine, channel } = resolveBrowserEngine(browserType);

    console.log(
      `[Playwright] Launching ${browserType} for ${account.email}...`,
    );

    // Use playwright-extra with stealth if available, otherwise regular chromium
    const engineToUse = chromiumWithStealth || engine;

    const acctContext = await engineToUse.launchPersistentContext(profilePath, {
      headless,
      channel,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
      ignoreDefaultArgs: ["--enable-automation"],
      extraHTTPHeaders: {
        'sec-ch-ua': '"Chromium";v="149", "Google Chrome";v="149", "Not/A)Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox",
        "--disable-extensions",
        "--disable-default-apps",
        "--disable-sync",
        "--mute-audio",
        "--no-default-browser-check",
        "--no-first-run",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dev-shm-usage",
        "--js-flags=--max-old-space-size=256"
      ],
    });

    // Bloqueia recursos pesados/não essenciais para economizar RAM e banda em background
    await acctContext.route("**/*.{png,jpg,jpeg,gif,webp,svg,mp4,webm,ogg,mp3}", route => {
      const url = route.request().url();
      if (url.includes('captcha') || url.includes('alicdn') || url.includes('aliyun') || url.includes('_____tmd_____')) {
        route.continue();
      } else {
        route.abort();
      }
    });

    // Additional stealth scripts
    await acctContext.addInitScript(getStealthScript());

    const acctPage = await acctContext.newPage();
    accountContexts.set(account.id, acctContext);
    accountPages.set(account.id, acctPage);

    // Check if already logged in
    const cookies = await acctContext.cookies();
    const hasAuthCookie = cookies.some(
      (c) =>
        c.name.toLowerCase().includes("token") ||
        c.name.toLowerCase().includes("session"),
    );

    if (!hasAuthCookie && account.email && account.password) {
      await loginToQwen(account.id, account.email, account.password);
    }

    // Capture headers by navigating and intercepting
    await captureHeaders(account.id);
  } finally {
    release();
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function loginToQwen(
  accountId: string,
  email: string,
  password: string,
): Promise<boolean> {
  const page = accountPages.get(accountId);
  if (!page) return false;

  console.log(`[Playwright] Logging in ${email}...`);

  // Try API login first
  const apiResult = await loginViaApi(page, email, password);
  if (apiResult) {
    console.log(`[Playwright] API login successful for ${email}`);
    return true;
  }

  // Fallback to UI login
  console.log(`[Playwright] API login failed, trying UI login for ${email}...`);
  const uiResult = await loginViaUi(page, email, password);
  if (uiResult) {
    console.log(`[Playwright] UI login successful for ${email}`);
    return true;
  }

  console.error(`[Playwright] All login methods failed for ${email}`);
  return false;
}

async function loginViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  try {
    await page.goto("https://chat.qwen.ai/auth", {
      waitUntil: "domcontentloaded",
    });
    await sleep(2000);

    // Check if already logged in
    if (!page.url().includes("/auth")) {
      return true;
    }

    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const result = await page.evaluate(
      async ({ email, password }) => {
        try {
          const response = await fetch(
            "https://chat.qwen.ai/api/v2/auths/signin",
            {
              method: "POST",
              headers: {
                accept: "application/json, text/plain, */*",
                "content-type": "application/json",
                source: "web",
                timezone: new Date().toString().split(" (")[0],
                "x-request-id": crypto.randomUUID(),
              },
              body: JSON.stringify({ email, password, login_type: "email" }),
            },
          );
          const data = await response.json();
          return { ok: response.ok, data };
        } catch (e: any) {
          return { ok: false, error: e.message };
        }
      },
      { email, password: hashedPassword },
    );

    if (result.ok) {
      await page.goto("https://chat.qwen.ai/", {
        waitUntil: "domcontentloaded",
      });
      return !page.url().includes("auth") && !page.url().includes("login");
    }

    return false;
  } catch (err) {
    console.warn(`[Playwright] API login error: ${err}`);
    return false;
  }
}

async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  try {
    await page.goto("https://chat.qwen.ai/auth", {
      waitUntil: "domcontentloaded",
    });
    await sleep(2000);

    // Check if already logged in
    if (!page.url().includes("/auth")) {
      return true;
    }

    // Wait for email input
    const emailSelector = 'input[type="email"], input[placeholder*="Email"]';
    try {
      await page.waitForSelector(emailSelector, { timeout: 10000 });
    } catch {
      if (!page.url().includes("/auth")) return true;
      throw new Error("Email input not found");
    }

    // Fill email
    console.log(`[Playwright] UI: Filling email...`);
    await page.fill(emailSelector, email);
    await page.keyboard.press("Enter");
    await sleep(1500);

    // Wait for password input
    const passwordSelector = 'input[type="password"]';
    await page.waitForSelector(passwordSelector, { timeout: 10000 });

    // Fill password
    console.log(`[Playwright] UI: Filling password...`);
    await page.fill(passwordSelector, password);
    await page.keyboard.press("Enter");
    await sleep(3000);

    // Check if login was successful
    const isLoggedIn =
      !page.url().includes("auth") && !page.url().includes("login");

    if (isLoggedIn) {
      await page.goto("https://chat.qwen.ai/", {
        waitUntil: "domcontentloaded",
      });
    }

    return isLoggedIn;
  } catch (err) {
    console.warn(`[Playwright] UI login error: ${err}`);
    return false;
  }
}

// ─── Header Capture ───────────────────────────────────────────────────────────

async function captureHeaders(accountId: string): Promise<void> {
  const page = accountPages.get(accountId);
  if (!page) return;

  const cache = getHeaderCache(accountId);

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[Playwright] Header capture timeout for ${accountId}`);
      resolve();
    }, 30000);

    const routeHandler = async (route: any, request: any) => {
      clearTimeout(timeout);

      const reqHeaders = request.headers();
      cache.headers = {
        cookie: reqHeaders["cookie"] || "",
        "bx-ua": reqHeaders["bx-ua"] || "",
        "bx-umidtoken": reqHeaders["bx-umidtoken"] || "",
        "bx-v": reqHeaders["bx-v"] || "2.5.36",
        "user-agent": reqHeaders["user-agent"] || "",
      };
      cache.lastRefresh = Date.now();

      console.log(`[Playwright] Headers captured for ${accountId}`);

      await route.abort("aborted");
      await page.unroute("**/api/v2/chat/completions*", routeHandler);
      resolve();
    };

    page.route("**/api/v2/chat/completions*", routeHandler).then(async () => {
      // Navigate to Qwen and trigger a request
      await page.goto("https://chat.qwen.ai/", {
        waitUntil: "domcontentloaded",
      });
      await sleep(2000);

      const hasEarlyCaptcha = await page.locator('iframe#baxia-dialog-content, iframe[src*="_____tmd_____/punish"]').first().isVisible().catch(() => false);
      if (hasEarlyCaptcha) {
        console.log(`[Playwright] Captcha detected early for ${accountId}, attempting auto-solve...`);
        const solved = await solveBaxiaCaptcha(page);
        if (solved) {
          console.log(`[Playwright] Captcha auto-solved natively for ${accountId}! Returning control...`);
          resolve();
          return;
        }
      }

      // Type something and send to trigger header capture
      const inputSelector =
        'textarea:visible, [contenteditable="true"]:visible';
      try {
        await page.focus(inputSelector);
        await page.fill(inputSelector, "");
        await page.type(inputSelector, "a", { delay: 100 });
        await sleep(1000);

        // Try to click send button
        const sendSelectors = [
          ".message-input-right-button-send .send-button",
          ".chat-prompt-send-button",
          "button.send-button",
        ];

        for (const selector of sendSelectors) {
          try {
            const btn = await page.$(selector);
            if (btn && (await btn.isVisible())) {
              await btn.click({ force: true, delay: 50 });
              break;
            }
          } catch {
            // Try next selector
          }
        }

        // Fallback to Enter key
        await page.keyboard.press("Enter");
        await sleep(2000);

        const hasCaptcha = await page.locator('iframe#baxia-dialog-content, iframe[src*="_____tmd_____/punish"]').first().isVisible().catch(() => false);
        if (hasCaptcha) {
          console.log(`[Playwright] Captcha detected for ${accountId}, attempting auto-solve...`);
          const solved = await solveBaxiaCaptcha(page);
          if (solved) {
            console.log(`[Playwright] Captcha auto-solved natively for ${accountId}! Returning control...`);
            resolve();
            return;
          } else {
            console.warn(`[Playwright] Auto-solve failed for ${accountId}, waiting remaining time for manual/microservice fallback...`);
          }
        }
      } catch (err) {
        console.warn(`[Playwright] Error triggering request: ${err}`);
        resolve();
      }
    });
  });
}

async function refreshHeadersInternal(accountId: string): Promise<void> {
  const cache = getHeaderCache(accountId);
  if (cache.refreshInProgress) return;

  // Invalida o cache antigo para forçar leitura dos novos cookies de bypass (x5sec) após a resolução manual do captcha
  cookieCaches.delete(accountId);

  cache.refreshInProgress = true;
  try {
    await captureHeaders(accountId);
  } finally {
    cache.refreshInProgress = false;
  }
}

export async function refreshHeaders(accountId: string): Promise<void> {
  const release = await getAccountMutex(accountId).acquire();
  try {
    await refreshHeadersInternal(accountId);
  } finally {
    release();
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function closePlaywrightForAccount(
  accountId: string,
): Promise<void> {
  const release = await getAccountMutex(accountId).acquire();
  try {
    const acctContext = accountContexts.get(accountId);
    if (acctContext) {
      await acctContext.close();
      accountContexts.delete(accountId);
      accountPages.delete(accountId);
      headerCaches.delete(accountId);
      cookieCaches.delete(accountId);
      accountMutexes.delete(accountId);
    }
  } finally {
    release();
  }
}

export async function closeAllPlaywright(): Promise<void> {
  for (const accountId of accountContexts.keys()) {
    await closePlaywrightForAccount(accountId);
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function isPlaywrightInitialized(accountId: string): boolean {
  return accountPages.has(accountId);
}

export function getPlaywrightStatus(): Record<
  string,
  { initialized: boolean; hasHeaders: boolean }
> {
  const status: Record<string, { initialized: boolean; hasHeaders: boolean }> =
    {};
  for (const [accountId, cache] of headerCaches.entries()) {
    status[accountId] = {
      initialized: accountPages.has(accountId),
      hasHeaders: !!cache.headers["bx-ua"],
    };
  }
  return status;
}

// ─── Native Captcha Solver ───────────────────────────────────────────────────

/**
 * Solves the Baxia slidein captcha inside an iframe on the page.
 */
export async function solveBaxiaCaptcha(page: Page): Promise<boolean> {
  const iframeSelector = 'iframe#baxia-dialog-content, iframe[src*="_____tmd_____/punish"]';
  const iframeLocator = page.locator(iframeSelector).first();

  if (!(await iframeLocator.isVisible().catch(() => false))) {
    return false;
  }

  console.log('[Captcha] Baxia captcha iframe detected. Attempting to solve...');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const frame = page.frameLocator(iframeSelector);
      const slider = frame.locator('#nc_1_n1z, .btn_slide');

      // Wait for the slider element to be visible inside the frame
      await slider.waitFor({ state: 'visible', timeout: 5000 });

      const sliderBox = await slider.boundingBox();
      if (!sliderBox) {
        console.warn(`[Captcha] Attempt ${attempt}: Slider bounding box not found.`);
        await sleep(1000);
        continue;
      }

      const track = frame.locator('#nc_1_n1t, .nc_scale');
      const trackBox = await track.boundingBox();
      const dragDistance = trackBox ? (trackBox.width - sliderBox.width) : 260;

      const startX = sliderBox.x + sliderBox.width / 2;
      const startY = sliderBox.y + sliderBox.height / 2;

      console.log(`[Captcha] Attempt ${attempt}: Dragging slider from x=${startX}, y=${startY} by ${dragDistance}px`);
      
      // Move mouse to slider center, hover for a moment
      await page.mouse.move(startX, startY, { steps: 5 });
      await sleep(150 + Math.floor(Math.random() * 150));
      
      // Press down
      await page.mouse.down();
      await sleep(100 + Math.floor(Math.random() * 100));

      // Ease-in-out dragging simulation to mimic human acceleration & deceleration
      const steps = 25;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Cubic ease-in-out formula
        const progress = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        const x = startX + dragDistance * progress + (Math.random() * 2 - 1);
        // Add subtle vertical jitter
        const y = startY + (Math.random() * 2 - 1);
        
        await page.mouse.move(x, y, { steps: 2 });
        await sleep(15 + Math.floor(Math.random() * 20));
      }

      // Pause at the end before releasing the mouse button
      await sleep(200 + Math.floor(Math.random() * 200));
      await page.mouse.up();

      // Wait a moment for the page to register success and close the dialog
      await sleep(2000);

      // Verify if the captcha is solved: the iframe should be hidden/gone, or we see a success element
      const isGone = !(await iframeLocator.isVisible().catch(() => false));
      if (isGone) {
        console.log('[Captcha] Baxia captcha solved successfully (iframe closed).');
        return true;
      }

      const okElement = frame.locator('.btn_ok, .nc_ok, div#nc-loading-circle');
      const isOkVisible = await okElement.isVisible().catch(() => false);
      if (isOkVisible) {
        console.log('[Captcha] Baxia captcha solved successfully (OK state detected).');
        await sleep(1500); // Wait for transition
        return true;
      }

      console.warn(`[Captcha] Attempt ${attempt} did not solve the captcha. Retrying...`);
      await sleep(1000);
    } catch (err: any) {
      console.error(`[Captcha] Error during attempt ${attempt}:`, err.message);
      await sleep(1000);
    }
  }

  console.error('[Captcha] Failed to solve Baxia captcha after 3 attempts.');
  return false;
}

// ─── Stealth Script ──────────────────────────────────────────────────────────

export function getStealthScript(): string {
  return `
    // 1. Webdriver evasion
    try {
      if (navigator.webdriver !== undefined) {
        const proto = Object.getPrototypeOf(navigator);
        const desc = Object.getOwnPropertyDescriptor(proto, 'webdriver');
        if (desc) {
          Object.defineProperty(proto, 'webdriver', {
            ...desc,
            get: () => undefined
          });
        }
      }
    } catch(e) {}
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. User-Agent and AppVersion Evasion
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
    try {
      Object.defineProperty(navigator, 'userAgent', { get: () => customUA });
      Object.defineProperty(navigator, 'appVersion', { get: () => customUA.replace('Mozilla/', '') });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    } catch(e) {}

    // 3. User-Agent Client Hints Evasion
    try {
      const userAgentData = {
        brands: [
          { brand: 'Not/A)Brand', version: '99' },
          { brand: 'Google Chrome', version: '149' },
          { brand: 'Chromium', version: '149' }
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async (hints) => {
          return {
            brands: [
              { brand: 'Not/A)Brand', version: '99.0.0.0' },
              { brand: 'Google Chrome', version: '149.0.0.0' },
              { brand: 'Chromium', version: '149.0.0.0' }
            ],
            mobile: false,
            platform: 'Windows',
            platformVersion: '15.0.0', // Windows 11
            architecture: 'x86',
            bitness: '64',
            model: '',
            uaFullVersion: '149.0.0.0',
            fullVersionList: [
              { brand: 'Not/A)Brand', version: '99.0.0.0' },
              { brand: 'Google Chrome', version: '149.0.0.0' },
              { brand: 'Chromium', version: '149.0.0.0' }
            ]
          };
        }
      };
      Object.defineProperty(navigator, 'userAgentData', { get: () => userAgentData });
    } catch(e) {}

    // 4. Standard Browser Props
    Object.defineProperty(navigator, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en'],
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    // 5. Headless Dimensions Evasion (avoid outerWidth/outerHeight being 0)
    try {
      if (window.outerWidth === 0 || window.outerHeight === 0) {
        Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
        Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 });
      }
    } catch(e) {}

    // 6. Chrome API mocking
    window.chrome = {
      runtime: { onConnect: {}, onMessage: {} },
      loadTimes: function() { return {}; },
      csi: function() { return {}; },
      app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
    };

    // 7. Notification Permission query override
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: (typeof Notification !== 'undefined' ? Notification.permission : 'default'), onchange: null })
        : originalQuery(parameters);

    // 8. WebGL Spoofing (Vendor & Renderer)
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.apply(this, arguments);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter2.apply(this, arguments);
      };
    }

    // 9. WebGL readPixels noise injection to prevent WebGL fingerprinting
    const _readPixels = WebGLRenderingContext.prototype.readPixels;
    WebGLRenderingContext.prototype.readPixels = function(x, y, width, height, format, type, pixels) {
      _readPixels.apply(this, arguments);
      if (pixels) {
        for (let i = 0; i < pixels.length; i++) {
          if (Math.random() < 0.03) {
            pixels[i] = Math.min(255, Math.max(0, pixels[i] + (Math.random() > 0.5 ? 1 : -1)));
          }
        }
      }
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const _readPixels2 = WebGL2RenderingContext.prototype.readPixels;
      WebGL2RenderingContext.prototype.readPixels = function(x, y, width, height, format, type, pixels) {
        _readPixels2.apply(this, arguments);
        if (pixels) {
          for (let i = 0; i < pixels.length; i++) {
            if (Math.random() < 0.03) {
              pixels[i] = Math.min(255, Math.max(0, pixels[i] + (Math.random() > 0.5 ? 1 : -1)));
            }
          }
        }
      }
    }

    // 10. Connection mock
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });

    // 11. Plugins & MimeTypes Evasion
    (function() {
      function makeMime(desc, suffixes, type) {
        const m = { description: desc, suffixes: suffixes, type: type };
        return m;
      }
      const pdfMime = makeMime('Portable Document Format', 'pdf', 'application/pdf');
      const pdfxMime = makeMime('Portable Document Format', 'pdf', 'text/pdf');
      const pdfPlugin = {
        name: 'PDF Viewer',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        length: 2,
        0: pdfMime,
        1: pdfxMime,
      };
      pdfMime.enabledPlugin = pdfPlugin;
      pdfxMime.enabledPlugin = pdfPlugin;

      const chromePdfMime = makeMime('Portable Document Format', 'pdf', 'application/pdf');
      const chromePdfMime2 = makeMime('Portable Document Format', 'pdf', 'text/pdf');
      const chromePdfPlugin = {
        name: 'Chrome PDF Viewer',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        length: 2,
        0: chromePdfMime,
        1: chromePdfMime2,
      };
      chromePdfMime.enabledPlugin = chromePdfPlugin;
      chromePdfMime2.enabledPlugin = chromePdfPlugin;

      const nativePlugin = {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
        length: 2,
        0: makeMime('Native Client Executable', '', 'application/x-nacl'),
        1: makeMime('Portable Native Client Executable', '', 'application/x-pnacl'),
      };
      nativePlugin[0].enabledPlugin = nativePlugin;
      nativePlugin[1].enabledPlugin = nativePlugin;

      const pluginsList = [pdfPlugin, chromePdfPlugin, nativePlugin];
      const mimeList = [pdfMime, pdfxMime, chromePdfMime, chromePdfMime2, nativePlugin[0], nativePlugin[1]];

      function makeNamedNodeMap(items, namedEntries) {
        const arr = [...items];
        for (const [k, v] of namedEntries) arr[k] = v;
        arr.item = function(i) { return this[i] || null; };
        arr.namedItem = function(name) { return this[name] || null; };
        arr.refresh = function() {};
        return arr;
      }

      const pluginEntries = pluginsList.map((p, i) => [p.name, p]);
      const mimeEntries = mimeList.map((m) => [m.type, m]);

      const pluginsArr = makeNamedNodeMap(pluginsList, pluginEntries);
      const mimeArr = makeNamedNodeMap(mimeList, mimeEntries);

      Object.defineProperty(navigator, 'plugins', { get: () => pluginsArr });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeArr });
    })();

    // 12. Advanced Canvas Fingerprinting Evasion
    (function() {
      const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
      const _toBlob = HTMLCanvasElement.prototype.toBlob;
      const _getImageData = CanvasRenderingContext2D.prototype.getImageData;

      function addNoise(canvas) {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const style = ctx.fillStyle;
          // Very slight noise fill
          ctx.fillStyle = 'rgba(255,255,255,0.01)';
          ctx.fillRect(0, 0, 1, 1);
          ctx.fillStyle = style;
        } catch(e) {}
      }

      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        addNoise(this);
        return _toDataURL.apply(this, args);
      };
      HTMLCanvasElement.prototype.toBlob = function(...args) {
        addNoise(this);
        return _toBlob.apply(this, args);
      };

      // Add noise to getImageData to break Canvas hash verification scripts
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        const imageData = _getImageData.apply(this, arguments);
        const data = imageData.data;
        // Subtle pixel manipulation
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() < 0.05) {
            data[i] = Math.min(255, Math.max(0, data[i] + (Math.random() > 0.5 ? 1 : -1)));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + (Math.random() > 0.5 ? 1 : -1)));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + (Math.random() > 0.5 ? 1 : -1)));
          }
        }
        return imageData;
      };
    })();

    // 13. Audio Fingerprinting Evasion
    (function() {
      if (typeof OfflineAudioContext === 'undefined') return;
      const _startRendering = OfflineAudioContext.prototype.startRendering;
      OfflineAudioContext.prototype.startRendering = function() {
        return _startRendering.apply(this, arguments).then(buffer => {
          try {
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
              const data = buffer.getChannelData(ch);
              for (let i = 0; i < Math.min(data.length, 100); i++) {
                data[i] += (Math.random() - 0.5) * 1e-7;
              }
            }
          } catch(e) {}
          return buffer;
        });
      };
    })();
  \`;
}


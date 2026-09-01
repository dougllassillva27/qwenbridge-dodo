import type { Locator, Page } from "playwright";
import { humanDrag, sleep } from "./human-behavior.ts";
import { config, parseResolverUrls } from "../core/config.ts";


export const BAXIA_DIALOG_SELECTOR = ".baxia-dialog";
export const BAXIA_CONTENT_SELECTOR = "#baxia-dialog-content";

const CAPTCHA_EVENT_EMOJI: Record<string, string> = {
  dialog_detected: "🛡️",
  challenge_opened: "🚪",
  recovery_skipped: "⏭️",
  iframe_found: "🖼️",
  challenge_detected: "🧩",
  challenge_not_found: "🔎",
  solve_started: "🛠️",
  slider_found: "🎚️",
  attempt_bounds_unavailable: "📍",
  attempt_geometry: "📐",
  attempt_not_solved: "⚠️",
  attempt_failed: "💥",
  slider_not_found: "❌",
  solve_succeeded: "✅",
  solve_failed: "❌",
  recovery_succeeded: "✅",
  recovery_not_solved: "⚠️",
  recovery_failed: "❌",
};

import { isVerboseLogEnabled } from "../core/logger.ts";

const captchaDebugEnabled =
  process.env.CAPTCHA_DEBUG === "true" || isVerboseLogEnabled();

function formatCaptchaLogValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return JSON.stringify(value.replace(/\s+/g, " ").slice(0, 160));
  }
  return String(value);
}

export function logBaxiaCaptcha(
  event: string,
  fields: Record<string, string | number | boolean> = {},
  important = false,
): void {
  if (!important && !captchaDebugEnabled) return;

  const suffix = Object.entries(fields)
    .map(([key, value]) => `${key}=${formatCaptchaLogValue(value)}`)
    .join(" ");
  const emoji = CAPTCHA_EVENT_EMOJI[event] ?? "ℹ️";
  const line = `${emoji} [Captcha] ${event}${suffix ? ` | ${suffix}` : ""}`;

  if (important) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const BAXIA_IFRAME_SELECTORS = [
  `${BAXIA_DIALOG_SELECTOR} ${BAXIA_CONTENT_SELECTOR} iframe`,
  `${BAXIA_CONTENT_SELECTOR} iframe`,
  "iframe#baxia-dialog-content",
  'iframe[src*="_____tmd_____/punish"]',
] as const;

const BAXIA_DOCUMENT_SELECTORS = [
  "#nocaptcha",
  "#baxia-punish .nc-container",
  "#baxia-punish",
] as const;

/**
 * Kept as a public selector for callers that need to identify a Baxia iframe.
 * The current Baxia page may use #baxia-dialog-content as a container around
 * the iframe, while older versions used the id directly on the iframe.
 */
export const BAXIA_IFRAME_SELECTOR = BAXIA_IFRAME_SELECTORS.join(", ");

const BAXIA_SLIDER_SELECTOR =
  "#nc_1_n1z, .nc_1_n1z, #nc_2_n1z, .nc_2_n1z, div[id*='_n1z'], span[id*='_n1z'], .btn_slide, .nc_wrapper .btn_slide, ._nc .btn_slide, .nc-container .btn_slide, div[role='slider'], div.slidetounlock, .nc_iconfont, .nc-lang-cnt, .button, span.btn_slide, div.btn_slide";
const BAXIA_TRACK_SELECTOR =
  "#nc_1_n1t, .nc_scale, #nc_2_n1t, .nc_2_n1t, div[id*='_n1t'], .nc_wrapper .nc_scale, ._nc .nc_scale, .nc-container .nc_scale, .nc_bg, .scale_text, #nc_1__scale_text, #nc_2__scale_text";
const BAXIA_CONTAINER_SELECTOR =
  "#nc_1_wrapper, #nc_2_wrapper, .nc-container, #nocaptcha, div[id*='nc_'][id*='_wrapper'], .nc_wrapper, #baxia-dialog-content, .baxia-dialog, #baxia-punish, body";
const BAXIA_SUCCESS_SELECTOR =
  ".btn_ok, .nc_ok, .nc_success, .nc_result, .nc_wrapper.nc-success, .nc_wrapper.success, [data-nc-lang=\"SUCCESS\"], [data-nc-lang=\"success\"], #nc-loading-circle";

/**
 * Envia uma captura do captcha para o microserviço captchaResolve (OpenAI/Vision).
 * Suporta múltiplos endpoints/IPs (ex: local e VPS) com failover automático.
 */
export async function resolveViaCaptchaService(
  frame: BaxiaLocatorContext,
  page: Page,
  accountId = "default",
  resolverUrl: string | string[] = config.captcha.resolverUrls.length > 0
    ? config.captcha.resolverUrls
    : config.captcha.resolverUrl,
): Promise<number | null> {
  const candidateUrls = parseResolverUrls(resolverUrl);
  if (candidateUrls.length === 0) return null;

  try {
    const container = frame.locator(BAXIA_CONTAINER_SELECTOR).first();
    let screenshotBuffer: Buffer | null = await (container as any)
      .screenshot({ timeout: 3000 })
      .catch(() => null);

    if (!screenshotBuffer && typeof (page as any).screenshot === "function") {
      screenshotBuffer = await (page as any)
        .screenshot({ timeout: 3000 })
        .catch(() => null);
    }

    if (!screenshotBuffer) {
      return null;
    }

    const base64Image = screenshotBuffer.toString("base64");

    for (let i = 0; i < candidateUrls.length; i++) {
      const baseUrl = candidateUrls[i];
      const targetUrl = `${baseUrl}/resolve`;
      const isLast = i === candidateUrls.length - 1;

      console.log(`📸 [Captcha] Enviando screenshot para captchaResolve (${targetUrl})...`);
      const start = Date.now();

      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            accountId,
          }),
          signal: AbortSignal.timeout(8000),
        }).catch((err) => {
          const errMsg = err?.name === "TimeoutError" ? "timeout de 8s excedido" : (err.message || String(err));
          if (!isLast) {
            console.warn(`⚠️ [Captcha] captchaResolve em ${targetUrl} indisponível (${errMsg}). Tentando próximo endpoint...`);
          } else {
            console.warn(`⚠️ [Captcha] captchaResolve em ${targetUrl} indisponível (${errMsg})`);
          }
          return null;
        });

        if (!res) continue;

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (!isLast) {
            console.warn(`⚠️ [Captcha] captchaResolve (${targetUrl}) HTTP ${res.status}: ${text.slice(0, 100)}. Tentando próximo endpoint...`);
          } else {
            console.warn(`⚠️ [Captcha] captchaResolve (${targetUrl}) HTTP ${res.status}: ${text.slice(0, 100)}`);
          }
          continue;
        }

        const data = (await res.json().catch(() => null)) as {
          success?: boolean;
          x?: number;
          error?: string;
        } | null;

        const duration = Date.now() - start;
        if (data && data.success && typeof data.x === "number" && !isNaN(data.x)) {
          console.log(`🤖 [Captcha] captchaResolve (${targetUrl}) (AI Vision) calculou arrasto X = ${data.x}px (${duration}ms)`);
          return data.x;
        } else {
          const errInfo = data?.error || JSON.stringify(data);
          if (!isLast) {
            console.warn(`⚠️ [Captcha] captchaResolve (${targetUrl}) não retornou coordenada válida: ${errInfo}. Tentando próximo endpoint...`);
          } else {
            console.warn(`⚠️ [Captcha] captchaResolve (${targetUrl}) não retornou coordenada válida: ${errInfo}`);
          }
        }
      } catch (err: any) {
        const errMsg = err?.name === "TimeoutError" ? "timeout de 8s excedido" : (err.message || String(err));
        if (!isLast) {
          console.warn(`⚠️ [Captcha] Erro ao consultar ${targetUrl}: ${errMsg}. Tentando próximo endpoint...`);
        } else {
          console.warn(`⚠️ [Captcha] Erro ao consultar ${targetUrl}: ${errMsg}`);
        }
      }
    }

    return null;
  } catch (err: any) {
    console.warn(`⚠️ [Captcha] Erro no captchaResolve: ${err.message || String(err)}`);
    return null;
  }
}

/**
 * A challenge served to a background fetch never renders anything: the WAF
 * answers the XHR with the punish document instead of the expected payload, so
 * the solver has no visible slider to drive. The body carries the challenge
 * URL, which the account page can open to make the same challenge visible.
 */
export function extractBaxiaChallengeUrl(
  body: string,
  baseUrl: string,
): string | null {
  if (!body) return null;

  // The URL arrives wrapped in JSON, an HTML attribute or a meta refresh, each
  // with its own escaping. Normalize before matching so one pattern covers all.
  const normalized = body
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  const candidates = normalized.match(
    /(?:https?:)?\/\/[^\s"'`\\<>()]*(?:_____tmd_____|x5secdata=)[^\s"'`\\<>()]*|\/[^\s"'`\\<>()]*(?:_____tmd_____|x5secdata=)[^\s"'`\\<>()]*/gi,
  );
  if (!candidates) return null;

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate, base);
    } catch {
      continue;
    }
    // The body is attacker-influenced content. Only the Qwen origin itself may
    // be opened in the authenticated account page.
    if (url.protocol !== base.protocol || url.host !== base.host) continue;
    return url.toString();
  }
  return null;
}

export interface BaxiaSolverOptions {
  maxAttempts?: number;
  waitForMs?: number;
  retryDelayMs?: number;
  settleMs?: number;
  sliderTimeoutMs?: number;
  accountId?: string;
}

interface BaxiaLocatorContext {
  locator(selector: string): Locator;
}

interface BaxiaChallengeTarget {
  /** Null means the NC document is the top-level document, not an iframe. */
  iframeSelector: string | null;
  locator: Locator;
}

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_SETTLE_MS = 2_000;
const DEFAULT_SLIDER_TIMEOUT_MS = 5_000;

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

async function findVisibleLocator(
  page: Page,
  selectors: readonly string[],
): Promise<{ selector: string; locator: Locator } | null> {
  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if (await isVisible(candidate)) {
      return { selector, locator: candidate };
    }
  }
  return null;
}

async function findVisibleIframe(
  page: Page,
): Promise<BaxiaChallengeTarget | null> {
  const iframe = await findVisibleLocator(page, BAXIA_IFRAME_SELECTORS);
  return iframe
    ? { iframeSelector: iframe.selector, locator: iframe.locator }
    : null;
}

async function findVisibleDocument(
  page: Page,
): Promise<BaxiaChallengeTarget | null> {
  const documentTarget = await findVisibleLocator(
    page,
    BAXIA_DOCUMENT_SELECTORS,
  );
  return documentTarget
    ? { iframeSelector: null, locator: documentTarget.locator }
    : null;
}

async function detectBaxiaChallenge(
  page: Page,
  timeoutMs: number,
): Promise<{
  dialogLocator: Locator;
  contentLocator: Locator;
  target: BaxiaChallengeTarget;
} | null> {
  const dialogLocator = page.locator(BAXIA_DIALOG_SELECTOR).first();
  const contentLocator = page.locator(BAXIA_CONTENT_SELECTOR).first();
  const topLevelRootLocator = page.locator("#baxia-punish").first();
  const deadline = Date.now() + timeoutMs;
  let dialogReported = false;

  while (true) {
    const dialogVisible = await isVisible(dialogLocator);
    const contentVisible = await isVisible(contentLocator);
    if ((dialogVisible || contentVisible) && !dialogReported) {
      logBaxiaCaptcha("dialog_detected");
      dialogReported = true;
    }

    const iframe = await findVisibleIframe(page);
    if (iframe) {
      logBaxiaCaptcha("iframe_found");
      return { dialogLocator, contentLocator, target: iframe };
    }

    const documentTarget = await findVisibleDocument(page);
    if (documentTarget) {
      logBaxiaCaptcha("challenge_detected", { scope: "top_level" });
      return {
        dialogLocator,
        // In this mode #baxia-punish/#nocaptcha is the challenge surface.
        contentLocator: (await isVisible(topLevelRootLocator))
          ? topLevelRootLocator
          : documentTarget.locator,
        target: documentTarget,
      };
    }

    if (Date.now() >= deadline) break;
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
  }

  if (dialogReported) {
    logBaxiaCaptcha("challenge_not_found", { scope: "dialog" });
  }
  return null;
}

async function hasSolvedState(
  challengeLocator: Locator,
  dialogLocator: Locator,
  contentLocator: Locator,
  frame: BaxiaLocatorContext,
): Promise<boolean> {
  const [challengeVisible, dialogVisible, contentVisible] = await Promise.all([
    isVisible(challengeLocator),
    isVisible(dialogLocator),
    isVisible(contentLocator),
  ]);

  // Baxia calls hide(true) on the outer dialog after it receives the success
  // message. Treat the challenge as solved only after its visible surfaces are
  // gone, which avoids refreshing headers while the postMessage is in flight.
  if (!challengeVisible && !dialogVisible && !contentVisible) return true;

  for (const selector of BAXIA_SUCCESS_SELECTOR.split(", ")) {
    if (await isVisible(frame.locator(selector.trim()))) return true;
  }
  return false;
}

async function waitForSolvedState(
  challengeLocator: Locator,
  dialogLocator: Locator,
  contentLocator: Locator,
  frame: BaxiaLocatorContext,
  timeoutMs: number,
): Promise<boolean> {
  if (await hasSolvedState(challengeLocator, dialogLocator, contentLocator, frame)) {
    return true;
  }
  if (timeoutMs <= 0) return false;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
    if (
      await hasSolvedState(
        challengeLocator,
        dialogLocator,
        contentLocator,
        frame,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function sanitizeCaptchaErrorDetail(error: unknown): string {
  const message =
    error instanceof Error ? error.message || error.name : String(error);
  return message
    .replace(/https?:\/\/[^\s"'`<>]+/gi, "<url>")
    .replace(/\/[^\s"'`<>]*_____tmd_____[^\s"'`<>]*/gi, "<challenge-path>")
    .replace(/x5secdata=[^\s"'`<>]*/gi, "x5secdata=<redacted>")
    .replace(/data:image\/[^\s"'`<>]+/gi, "<image-data>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

/**
 * Solve a Baxia/TMD slider challenge already present in the account page.
 *
 * This adapter interacts only with the visible first-party NC challenge. It
 * supports both the usual iframe dialog and a challenge document rendered
 * directly in the page. It does not capture screenshots, HTML, cookies, or
 * challenge tokens.
 */
export async function solveBaxiaCaptcha(
  page: Page,
  options: BaxiaSolverOptions = {},
): Promise<boolean> {
  const waitForMs = Math.max(0, options.waitForMs ?? 0);
  const maxAttempts = Math.max(
    1,
    Math.min(5, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
  );
  const retryDelayMs = Math.max(
    0,
    options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  );
  const settleMs = Math.max(0, options.settleMs ?? DEFAULT_SETTLE_MS);
  const sliderTimeoutMs = Math.max(
    500,
    options.sliderTimeoutMs ?? DEFAULT_SLIDER_TIMEOUT_MS,
  );

  const detected = await detectBaxiaChallenge(page, waitForMs);
  if (!detected) return false;

  const scope = detected.target.iframeSelector ? "iframe" : "top_level";
  let lastGeometry: { track?: number; slider?: number; distance?: number } = {};
  let lastReason = "unknown";
  let lastStage = "detect";
  let lastDetail = "";

  logBaxiaCaptcha("solve_started", { scope });

  // A frame selector is deliberately narrowed to the first matching iframe.
  // This matters when an old hidden Baxia iframe remains in the page after a
  // previous challenge. A null selector means the NC document is top-level.
  const frameSelector = detected.target.iframeSelector
    ? `${detected.target.iframeSelector} >> nth=0`
    : null;
  let sliderFoundReported = false;
  let sliderMissingReported = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let stage = "slider_wait";
    try {
      const frame: BaxiaLocatorContext = frameSelector
        ? page.frameLocator(frameSelector)
        : page;
      let slider = frame.locator(BAXIA_SLIDER_SELECTOR).first();
      try {
        await slider.waitFor({ state: "visible", timeout: sliderTimeoutMs });
      } catch (waitError) {
        // Fallback: se o seletor específico falhar, tenta achar qualquer botão de slider no frame
        const genericSlider = frame
          .locator(
            ".btn_slide, div[role='slider'], div.slidetounlock, .nc_iconfont, span[class*='btn']",
          )
          .first();
        if (await isVisible(genericSlider)) {
          slider = genericSlider;
        } else {
          throw waitError;
        }
      }

      if (!sliderFoundReported) {
        logBaxiaCaptcha("slider_found");
        sliderFoundReported = true;
      }

      stage = "geometry";
      let sliderBox = await slider.boundingBox().catch(() => null);
      if (!sliderBox) {
        const genericSlider = frame
          .locator(
            ".btn_slide, div[role='slider'], div.slidetounlock, .nc_iconfont, span[class*='btn']",
          )
          .first();
        sliderBox = await genericSlider.boundingBox().catch(() => null);
      }

      if (!sliderBox) {
        lastReason = "bounds_unavailable";
        logBaxiaCaptcha("attempt_bounds_unavailable", { attempt });
      } else {
        const track = frame.locator(BAXIA_TRACK_SELECTOR).first();
        const trackBox = await track.boundingBox().catch(() => null);
        const trackWidth = trackBox?.width ?? 300;
        let dragDistance = Math.max(0, trackWidth - sliderBox.width);

        if (attempt <= 2) {
          // Tentativas 1 e 2: SEMPRE tenta primeiramente pelo código local nativo (2x forçado localmente sem acionar a API)
          console.log(
            `📐 [Captcha] Tentativa ${attempt}/2 (Local): tentando resolução nativa por código (trilha padrão: ${Math.round(dragDistance)}px)...`,
          );
        } else {
          // Tentativas 3+: Se as 2 tentativas do código nativo falharem, recorre ao captchaResolve (Vision/OpenAI)
          console.log(
            `🤖 [Captcha] Tentativa ${attempt}: 2 tentativas locais falharam. Recorrendo ao captchaResolve (AI Vision)...`,
          );
          const accountId = options.accountId || "default";
          const visionX = await resolveViaCaptchaService(frame, page, accountId);
          if (visionX !== null && visionX > 0) {
            dragDistance = visionX;
          } else {
            console.log(
              `📐 [Captcha] captchaResolve indisponível/sem retorno. Usando cálculo de trilha padrão (${Math.round(dragDistance)}px)`,
            );
          }
        }

        lastGeometry = {
          track: Math.round(trackWidth),
          slider: Math.round(sliderBox.width),
          distance: Math.round(dragDistance),
        };
        logBaxiaCaptcha("attempt_geometry", {
          attempt,
          ...lastGeometry,
        });

        if (dragDistance > 0) {
          stage = "drag";
          await humanDrag(
            page,
            sliderBox.x + sliderBox.width / 2,
            sliderBox.y + sliderBox.height / 2,
            sliderBox.x + sliderBox.width / 2 + dragDistance,
            sliderBox.y + sliderBox.height / 2,
          );
        }
      }

      stage = "settle";
      if (
        await waitForSolvedState(
          detected.target.locator,
          detected.dialogLocator,
          detected.contentLocator,
          frame,
          settleMs,
        )
      ) {
        logBaxiaCaptcha(
          "solve_succeeded",
          {
            scope,
            attempt,
            ...lastGeometry,
          },
          true,
        );
        return true;
      }

      lastReason = "not_solved";
      logBaxiaCaptcha("attempt_not_solved", { attempt });
    } catch (error) {
      const errorKind = error instanceof Error ? error.name : "UnknownError";
      const detail = sanitizeCaptchaErrorDetail(error);
      if (!sliderFoundReported && !sliderMissingReported) {
        lastReason = "slider_not_found";
        logBaxiaCaptcha("slider_not_found", { attempt, stage, detail });
        sliderMissingReported = true;
      } else {
        lastReason = errorKind;
      }
      lastStage = stage;
      lastDetail = detail;
      // Include only a sanitized detail: full Playwright errors can contain
      // challenge URLs or page data that should not reach application logs.
      logBaxiaCaptcha("attempt_failed", {
        attempt,
        stage,
        error: errorKind,
        detail,
      });
    }

    if (attempt < maxAttempts && retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
  }

  if (!sliderFoundReported && !sliderMissingReported) {
    lastReason = "slider_not_found";
    logBaxiaCaptcha("slider_not_found");
  }
  logBaxiaCaptcha(
    "solve_failed",
    {
      scope,
      attempts: maxAttempts,
      reason: lastReason,
      stage: lastStage,
      detail: lastDetail || lastReason,
    },
    true,
  );
  return false;
}

export interface BaxiaCaptchaWatcher {
  stop(): void;
  promise: Promise<boolean>;
}

/**
 * Watch for a challenge that appears while a browser fetch is still waiting
 * for response metadata. The watcher intentionally does not hold the account
 * page mutex: the browser-side fetch already returned from page.evaluate and
 * the page must remain interactive while the challenge is displayed.
 */
export function startBaxiaCaptchaWatcher(
  page: Page,
  timeoutMs: number,
  options: Omit<BaxiaSolverOptions, "waitForMs"> = {},
): BaxiaCaptchaWatcher {
  let stopped = false;
  const deadline = Date.now() + Math.max(0, timeoutMs);

  const promise = (async (): Promise<boolean> => {
    while (!stopped && Date.now() < deadline) {
      try {
        if (page.isClosed()) break;
        const solved = await solveBaxiaCaptcha(page, {
          ...options,
          waitForMs: 0,
        });
        if (solved) return true;
      } catch {
        // A page reset/close is handled by the owning browser request.
      }

      if (!stopped && Date.now() < deadline) {
        await sleep(Math.min(250, Math.max(1, deadline - Date.now())));
      }
    }
    return false;
  })();

  return {
    stop: () => {
      stopped = true;
    },
    promise,
  };
}

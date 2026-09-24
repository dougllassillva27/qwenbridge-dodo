/**
 * WAF hard-block contingency (aligned with upstream account-isolation.ts).
 *
 * When a Baxia/TMD challenge could NOT be solved, quarantining the account is
 * not enough: the fingerprint seed is derived from the accountId, so the
 * account returns from cooldown on the SAME device identity the WAF already
 * flagged, and the challenge re-propagates immediately. The contingency here:
 *  - escalates the quarantine window per consecutive hard block (×2, capped),
 *  - rotates the account's fingerprint seed (fresh device identity),
 *  - closes the account's Playwright context so the next use re-initializes
 *    with the rotated profile (cookies/storage persist in the profile dir).
 *
 * Strictly per-account: a block on one account never touches another's state.
 */
import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { markAccountRateLimited } from "./account-manager.ts";
import { rotateFingerprintSeed } from "../services/fingerprint.ts";

const ESCALATION_FACTOR = 2;
const MAX_CONSECUTIVE_FOR_ESCALATION = 4;

interface WafBlockState {
  consecutiveHardBlocks: number;
  lastBlockAt: number;
}

const states = new Map<string, WafBlockState>();

export interface WafBlockResult {
  cooldownMs: number;
  fingerprintRotated: true;
  escalated: boolean;
}

type ContextResetListener = (accountId: string) => void | Promise<void>;
let contextResetListener: ContextResetListener | null = null;

type HeadedRecoveryListener = (accountId: string, cooldownMs: number) => void;
let headedRecoveryListener: HeadedRecoveryListener | null = null;

/**
 * Register the hook that flags an account for headed browser recovery.
 * Called when consecutive hard blocks exceed the threshold, indicating
 * the automated solver cannot resolve the challenge. The Playwright layer
 * uses `cooldownMs` to schedule a proactive re-init in headed mode once
 * the quarantine expires, so the automated solver retries with a real
 * GPU/rendering environment without waiting for the next user request.
 */
export function setWafHeadedRecoveryListener(fn: HeadedRecoveryListener | null): void {
  headedRecoveryListener = fn;
}

/**
 * Register the hook that physically resets an account's browser context after
 * a fingerprint rotation. Injected by the Playwright layer so this module
 * stays decoupled from it (and unit-testable without a browser).
 */
export function setWafContextResetListener(fn: ContextResetListener | null): void {
  contextResetListener = fn;
}

function getState(accountId: string): WafBlockState {
  let state = states.get(accountId);
  if (!state) {
    state = { consecutiveHardBlocks: 0, lastBlockAt: 0 };
    states.set(accountId, state);
  }
  return state;
}

export function getWafHardBlockCount(accountId: string): number {
  return states.get(accountId)?.consecutiveHardBlocks ?? 0;
}

/**
 * Record an unsolvable WAF challenge on `accountId`: quarantine (escalating),
 * rotate the device fingerprint, and reset the browser context.
 */
export function recordWafHardBlock(accountId: string): WafBlockResult {
  const state = getState(accountId);
  state.consecutiveHardBlocks += 1;
  state.lastBlockAt = Date.now();

  const base = config.captcha.accountCooldownMs;
  const cap = config.captcha.hardBlockMaxCooldownMs;
  const exponent = Math.min(
    state.consecutiveHardBlocks - 1,
    MAX_CONSECUTIVE_FOR_ESCALATION,
  );
  const cooldownMs = Math.min(cap, base * Math.pow(ESCALATION_FACTOR, exponent));

  if (cooldownMs > 0) {
    markAccountRateLimited(accountId, cooldownMs, "WafChallenge");
  }

  rotateFingerprintSeed(accountId);
  logger.warn(
    `[WafIsolation] Hard WAF block on ${accountId}: fingerprint rotated (streak ${state.consecutiveHardBlocks}), quarantined ${Math.round(cooldownMs / 1000)}s`,
  );

  // After 2+ consecutive hard blocks, the automated solver is clearly failing.
  // Flag the account for headed browser recovery so the next initialization
  // opens a visible window where the solver retries with real GPU rendering.
  if (state.consecutiveHardBlocks >= 2 && headedRecoveryListener && config.playwright.headedRecovery) {
    headedRecoveryListener(accountId, cooldownMs);
    logger.warn(
      `[WafIsolation] Account ${accountId} flagged for headed recovery after ${state.consecutiveHardBlocks} consecutive hard blocks.`,
    );
  }

  if (contextResetListener) {
    // Best-effort: the next use re-initializes the context with the rotated
    // profile; a failed close must not abort the quarantine.
    void Promise.resolve(contextResetListener(accountId)).catch((error: unknown) => {
      logger.warn(
        `[WafIsolation] Context reset listener failed for ${accountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  return {
    cooldownMs,
    fingerprintRotated: true,
    escalated: state.consecutiveHardBlocks > 1,
  };
}

/** A successful stream on the account clears the escalation streak. */
export function noteWafRecovery(accountId: string): void {
  const state = states.get(accountId);
  if (state && state.consecutiveHardBlocks > 0) {
    state.consecutiveHardBlocks = 0;
  }
}

/** Test/admin helper: drop all isolation state for an account. */
export function clearWafIsolation(accountId: string): void {
  states.delete(accountId);
}

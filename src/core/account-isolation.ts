/**
 * Per-account isolation & contingency system.
 *
 * Single authority for account block management, quarantine escalation,
 * and device fingerprint rotation on hard blocks (captcha, WAF flag, cookie invalid).
 */

import {
  markAccountRateLimited,
  clearAccountCooldown,
  getAccountCooldownInfo,
} from "./account-manager.ts";
import {
  rotateFingerprintSeed,
  getFingerprintSaltValue,
} from "../services/fingerprint.ts";
import { metrics } from "./metrics.ts";

export type BlockType =
  | "rate-limited"
  | "captcha"
  | "flagged"
  | "cookie-invalid"
  | "server-error";

const HARD_BLOCKS = new Set<BlockType>(["captcha", "flagged", "cookie-invalid"]);

const BASE_COOLDOWN_MS = 3 * 60 * 1000;
const HARD_BLOCK_COOLDOWN_MS = 30 * 60 * 1000;
const ESCALATION_FACTOR = 2;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_BLOCK_HISTORY = 50;

export interface BlockEvent {
  type: BlockType;
  at: number;
  detail?: string;
}

export interface AccountIsolationState {
  accountId: string;
  blocks: BlockEvent[];
  fingerprintRotations: number;
  resourceVersion: number;
  consecutiveBlocks: number;
  quarantinedAt: number | null;
  lastRecoveryAt: number | null;
}

const states = new Map<string, AccountIsolationState>();

type RotationListener = (accountId: string) => void | Promise<void>;
let rotationListener: RotationListener | null = null;

export function setFingerprintRotationListener(fn: RotationListener): void {
  rotationListener = fn;
}

function getState(accountId: string): AccountIsolationState {
  let s = states.get(accountId);
  if (!s) {
    s = {
      accountId,
      blocks: [],
      fingerprintRotations: 0,
      resourceVersion: 0,
      consecutiveBlocks: 0,
      quarantinedAt: null,
      lastRecoveryAt: null,
    };
    states.set(accountId, s);
  }
  return s;
}

function blockReason(type: BlockType): string {
  switch (type) {
    case "rate-limited":
      return "RateLimited";
    case "captcha":
      return "CaptchaBlocked";
    case "flagged":
      return "Flagged";
    case "cookie-invalid":
      return "CookieInvalid";
    default:
      return "ServerError";
  }
}

export interface BlockResult {
  quarantined: boolean;
  cooldownMs: number;
  fingerprintRotated: boolean;
  accountId: string;
  escalated: boolean;
}

export function recordAccountBlock(
  accountId: string,
  type: BlockType,
  detail?: string,
  opts?: { cooldownMs?: number },
): BlockResult {
  const s = getState(accountId);

  s.blocks.push({ type, at: Date.now(), detail });
  if (s.blocks.length > MAX_BLOCK_HISTORY) {
    s.blocks.splice(0, s.blocks.length - MAX_BLOCK_HISTORY);
  }

  const hard = HARD_BLOCKS.has(type);
  s.consecutiveBlocks += 1;

  let cooldownMs =
    opts?.cooldownMs ?? (hard ? HARD_BLOCK_COOLDOWN_MS : BASE_COOLDOWN_MS);
  let escalated = false;

  if (s.consecutiveBlocks > 1) {
    const factor = Math.pow(
      ESCALATION_FACTOR,
      Math.min(s.consecutiveBlocks - 1, 4),
    );
    cooldownMs = Math.min(MAX_COOLDOWN_MS, Math.round(cooldownMs * factor));
    escalated = true;
  }

  markAccountRateLimited(accountId, cooldownMs, blockReason(type));
  s.quarantinedAt = Date.now();

  let fingerprintRotated = false;
  if (hard) {
    rotateFingerprintSeed(accountId);
    s.fingerprintRotations += 1;
    s.resourceVersion += 1;
    fingerprintRotated = true;
    if (rotationListener) {
      try {
        void rotationListener(accountId);
      } catch (err: any) {
        console.warn(
          `[Isolation] fingerprint rotation listener failed for ${accountId}:`,
          err?.message,
        );
      }
    }
    console.warn(
      `🛡️ [Isolation] Hard block (${type}) on account ${accountId}: rotating device fingerprint (v${s.resourceVersion}) and resetting browser context.`,
    );
  }

  metrics.increment("isolation.blocks");

  return {
    quarantined: true,
    cooldownMs,
    fingerprintRotated,
    accountId,
    escalated,
  };
}

export function noteAccountRecovery(accountId: string): void {
  const s = getState(accountId);
  s.consecutiveBlocks = 0;
  s.quarantinedAt = null;
  s.lastRecoveryAt = Date.now();
}

export function clearAccountIsolation(accountId: string): void {
  states.delete(accountId);
  clearAccountCooldown(accountId);
}

export function getResourceVersion(accountId: string): number {
  return getState(accountId).resourceVersion;
}

export function getFingerprintSalt(accountId: string): number {
  return getFingerprintSaltValue(accountId);
}

export function requiresCrossAccountBootstrap(
  routedAccountId: string | null | undefined,
  sessionAccountId: string | null | undefined,
): boolean {
  if (!sessionAccountId) return false;
  return routedAccountId !== sessionAccountId;
}

export interface AccountIsolationStatus {
  blocks: number;
  consecutiveBlocks: number;
  fingerprintRotations: number;
  resourceVersion: number;
  quarantined: boolean;
  cooldownRemainingMs: number;
  lastReason: string | null;
}

export function getIsolationStatus(): Record<string, AccountIsolationStatus> {
  const out: Record<string, AccountIsolationStatus> = {};
  for (const [acctId, s] of states) {
    const cd = getAccountCooldownInfo(acctId);
    out[acctId] = {
      blocks: s.blocks.length,
      consecutiveBlocks: s.consecutiveBlocks,
      fingerprintRotations: s.fingerprintRotations,
      resourceVersion: s.resourceVersion,
      quarantined: cd !== null,
      cooldownRemainingMs: cd?.remainingMs ?? 0,
      lastReason: cd?.reason ?? null,
    };
  }
  return out;
}

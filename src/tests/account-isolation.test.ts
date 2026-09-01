import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recordAccountBlock,
  noteAccountRecovery,
  clearAccountIsolation,
  getResourceVersion,
  requiresCrossAccountBootstrap,
  setFingerprintRotationListener,
} from "../core/account-isolation.ts";
import { isAccountOnCooldown } from "../core/account-manager.ts";
import { getFingerprintSaltValue } from "../services/fingerprint.ts";

test("account-isolation: soft block sets cooldown and escalates on repeat", () => {
  const acct = "test-iso-soft-" + Date.now();
  clearAccountIsolation(acct);

  const first = recordAccountBlock(acct, "rate-limited");
  assert.equal(first.quarantined, true);
  assert.equal(first.escalated, false);
  assert.equal(first.fingerprintRotated, false);
  assert.equal(isAccountOnCooldown(acct), true);

  const second = recordAccountBlock(acct, "rate-limited");
  assert.equal(second.escalated, true);
  assert.ok(second.cooldownMs > first.cooldownMs);

  clearAccountIsolation(acct);
  assert.equal(isAccountOnCooldown(acct), false);
});

test("account-isolation: hard block rotates fingerprint and notifies listener", () => {
  const acct = "test-iso-hard-" + Date.now();
  clearAccountIsolation(acct);

  let notifiedAccount: string | null = null;
  setFingerprintRotationListener((id) => {
    notifiedAccount = id;
  });

  const saltBefore = getFingerprintSaltValue(acct);
  const versionBefore = getResourceVersion(acct);

  const result = recordAccountBlock(acct, "captcha");
  assert.equal(result.quarantined, true);
  assert.equal(result.fingerprintRotated, true);
  assert.equal(notifiedAccount, acct);

  const saltAfter = getFingerprintSaltValue(acct);
  const versionAfter = getResourceVersion(acct);

  assert.equal(saltAfter, saltBefore + 1);
  assert.equal(versionAfter, versionBefore + 1);

  clearAccountIsolation(acct);
});

test("account-isolation: noteAccountRecovery resets consecutive blocks", () => {
  const acct = "test-iso-recovery-" + Date.now();
  clearAccountIsolation(acct);

  recordAccountBlock(acct, "server-error");
  recordAccountBlock(acct, "server-error");

  noteAccountRecovery(acct);

  const fresh = recordAccountBlock(acct, "server-error");
  assert.equal(fresh.escalated, false);

  clearAccountIsolation(acct);
});

test("account-isolation: requiresCrossAccountBootstrap detects switched account", () => {
  assert.equal(requiresCrossAccountBootstrap("acct-1", "acct-1"), false);
  assert.equal(requiresCrossAccountBootstrap("acct-2", "acct-1"), true);
  assert.equal(requiresCrossAccountBootstrap("acct-2", null), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireAccountLease,
  hasActiveSessionLease,
  abortLeaseBySessionLabel,
  resetAccountConcurrencyForTests,
} from "../core/account-concurrency.ts";

test("hasActiveSessionLease detects active lease for session and ignores parallelEscape", async () => {
  resetAccountConcurrencyForTests();
  const sessionLabel = "sess_subagent_test_1";

  // Initially no active lease
  assert.strictEqual(hasActiveSessionLease(sessionLabel), false);

  // Acquire lease
  const lease1 = await acquireAccountLease("acct-1", { label: sessionLabel });
  assert.ok(lease1);
  assert.strictEqual(hasActiveSessionLease(sessionLabel), true);

  // Acquire a parallel escape lease on another account
  const lease2 = await acquireAccountLease("acct-2", {
    label: sessionLabel,
    parallelEscape: true,
  });
  assert.ok(lease2);

  // Release main lease
  lease1.release();

  // Now only the parallelEscape lease remains, so hasActiveSessionLease should return false
  assert.strictEqual(hasActiveSessionLease(sessionLabel), false);

  // Cleanup
  lease2.release();
  resetAccountConcurrencyForTests();
});

test("implicit subagent sessions are not aborted when canSupersede is false", async () => {
  resetAccountConcurrencyForTests();
  const sessionLabel = "sess_subagent_test_2";

  let aborted = false;
  const controller = new AbortController();
  controller.signal.addEventListener("abort", () => {
    aborted = true;
  });

  // Acquire lease for Subagent 1
  const lease1 = await acquireAccountLease("acct-1", {
    label: sessionLabel,
    leaseAbortController: controller,
  });
  assert.ok(lease1);

  // Simulate arrival of Subagent 2 with canSupersede = false (implicit session from Anthropic)
  const canSupersede = false;
  const superseded = canSupersede
    ? abortLeaseBySessionLabel(sessionLabel, { onlyIfEmitted: true })
    : false;

  assert.strictEqual(superseded, false);
  assert.strictEqual(aborted, false); // Subagent 1 was NOT aborted!
  assert.strictEqual(hasActiveSessionLease(sessionLabel), true);

  // Subagent 2 would now cleanly activate parallelEscape = true
  const parallelEscape = !superseded && hasActiveSessionLease(sessionLabel);
  assert.strictEqual(parallelEscape, true);

  // Cleanup
  lease1.release();
  resetAccountConcurrencyForTests();
});

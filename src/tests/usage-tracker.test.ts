import test from 'node:test';
import assert from 'node:assert';
import { trackUsage, getUserUsage, getAllUsage, resetUsage } from '../core/usage-tracker.ts';

test('usage-tracker: tracks real input and output tokens', () => {
  resetUsage();

  trackUsage('user-1', 'hello world', false, 50, 10);
  const u1 = getUserUsage('user-1');
  assert.ok(u1);
  assert.strictEqual(u1.requestCount, 1);
  assert.strictEqual(u1.errorCount, 0);
  assert.strictEqual(u1.inputTokens, 10);
  assert.strictEqual(u1.outputTokens, 50);
  assert.strictEqual(u1.totalTokens, 60);

  // Second request for same user
  trackUsage('user-1', 'second prompt', false, 100, 20);
  const u1Updated = getUserUsage('user-1');
  assert.ok(u1Updated);
  assert.strictEqual(u1Updated.requestCount, 2);
  assert.strictEqual(u1Updated.inputTokens, 30);
  assert.strictEqual(u1Updated.outputTokens, 150);
  assert.strictEqual(u1Updated.totalTokens, 180);

  // Error request
  trackUsage('user-1', 'failed prompt', true, 0, 5);
  const u1Error = getUserUsage('user-1');
  assert.ok(u1Error);
  assert.strictEqual(u1Error.requestCount, 3);
  assert.strictEqual(u1Error.errorCount, 1);
  assert.strictEqual(u1Error.inputTokens, 35);
  assert.strictEqual(u1Error.outputTokens, 150);
  assert.strictEqual(u1Error.totalTokens, 185);

  // Fallback to estimated tokens when inputTokens is omitted
  trackUsage('user-2', 'short text', false, 25);
  const u2 = getUserUsage('user-2');
  assert.ok(u2);
  assert.strictEqual(u2.requestCount, 1);
  assert.ok(u2.inputTokens > 0, 'should estimate input tokens from text');
  assert.strictEqual(u2.outputTokens, 25);
  assert.strictEqual(u2.totalTokens, u2.inputTokens + 25);

  resetUsage();
});

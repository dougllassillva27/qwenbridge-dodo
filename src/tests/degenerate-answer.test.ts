import test from 'node:test';
import assert from 'node:assert';
import { isDegenerateAnswer, buildAnswerDirective } from '../utils/degenerate-answer.ts';

test('degenerate-answer: detects terse acknowledgments', () => {
  assert.strictEqual(isDegenerateAnswer('Yes'), true);
  assert.strictEqual(isDegenerateAnswer('Yes.'), true);
  assert.strictEqual(isDegenerateAnswer('Sim'), true);
  assert.strictEqual(isDegenerateAnswer('Claro que sim'), true);
  assert.strictEqual(isDegenerateAnswer('OK'), true);
  assert.strictEqual(isDegenerateAnswer('Entendido.'), true);
  assert.strictEqual(isDegenerateAnswer('Perfeito'), true);
  assert.strictEqual(isDegenerateAnswer(''), false);
  assert.strictEqual(isDegenerateAnswer('A resposta completa com todos os detalhes que você pediu.'), false);
  assert.strictEqual(isDegenerateAnswer('Yes, and here is the full reasoning that follows.'), false);
  assert.strictEqual(isDegenerateAnswer('Sim, vamos fazer X, Y e Z.'), false);
});

test('degenerate-answer: builds corrective directive referencing the rejected reply', () => {
  const directive = buildAnswerDirective('Yes');
  assert.ok(directive.includes('Your previous reply (Yes) was rejected'));
  assert.ok(directive.includes('NEVER reply with only a short acknowledgment'));
  const plain = buildAnswerDirective();
  assert.ok(!plain.includes('Your previous reply'));
  assert.ok(plain.includes('[SYSTEM DIRECTIVE]'));
});

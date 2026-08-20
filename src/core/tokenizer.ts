/**
 * Token estimation helper for user and model usage tracking.
 */

export function countTokens(text: string, divisor = 3.5): number {
  if (!text) return 0;
  return Math.ceil(text.length / divisor);
}
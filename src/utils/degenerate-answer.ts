/**
 * Detection of degenerate LLM replies: terse acknowledgments ("Yes", "Sim",
 * "OK") that carry no actual answer. Text file uploads sometimes confuse the
 * model into producing one of these; the proxy must never surface them as the
 * final answer.
 */

const DEGENERATE_PHRASES = [
  'yes',
  'yeah',
  'yep',
  'yup',
  'ya',
  'y',
  'ok',
  'okay',
  'oke',
  'okey',
  'sim',
  'claro',
  'claro que sim',
  'certo',
  'perfeito',
  'entendido',
  'com certeza',
  'confirmado',
  'afirmativo',
  'positivo',
  'roger',
  'fine',
  'done',
  'received',
  'okido',
  'got it',
  'all good',
];

// Matches a reply consisting only of the phrases above plus light punctuation.
const DEGENERATE_RE = new RegExp(
  `^(?:\\s*(?:${DEGENERATE_PHRASES.join('|')})\\s*[.!?]?\\s*)+$`,
  'i',
);

export function isDegenerateAnswer(content: string | null | undefined): boolean {
  const text = (content || '').trim();
  if (!text || text.length > 200) return false;
  return DEGENERATE_RE.test(text);
}

/**
 * Builds the directive appended to a prompt that instructs the model to answer
 * the last user message in full and to never reply with a bare acknowledgment.
 */
export function buildAnswerDirective(
  previousReply?: string,
  reason = 'a brief reply that does not answer the question',
): string {
  return [
    '',
    '---',
    `[SYSTEM DIRECTIVE] ${previousReply
      ? `Your previous reply (${previousReply.trim().slice(0, 80)}) was rejected because ${reason}. `
      : ''}Always answer the FINAL "User:" block above with a complete, detailed, and unambiguous response in the same language.`,
    'NEVER reply with only a short acknowledgment such as "Yes", "OK", "Sim", "Entendido", or a bare confirmation — those are treated as invalid answers. If the final User message is a question, answer it fully; if it is an instruction, execute it fully and report what you did.',
    '[/SYSTEM DIRECTIVE]',
  ].join('\n');
}
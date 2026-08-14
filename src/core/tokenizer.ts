import { get_encoding, type Tiktoken } from 'tiktoken'

/**
 * Token estimation via tiktoken (BPE). Qwen models have no exact tiktoken
 * encoding, so cl100k_base is used as the closest general multilingual BPE.
 * The encoder is created lazily once and reused for the process lifetime.
 */

let encoding: Tiktoken | null = null
let encodingFailed = false

function getEncoding(): Tiktoken | null {
  if (encoding) return encoding
  if (encodingFailed) return null
  try {
    encoding = get_encoding('cl100k_base')
    return encoding
  } catch (err) {
    encodingFailed = true
    console.warn(`[Tokenizer] tiktoken unavailable, falling back to chars/divisor heuristic: ${(err as Error).message}`)
    return null
  }
}

export function countTokens(text: string, divisor = 3.5): number {
  const enc = getEncoding()
  if (!enc) return Math.ceil(text.length / divisor)
  try {
    return enc.encode(text).length
  } catch {
    return Math.ceil(text.length / divisor)
  }
}
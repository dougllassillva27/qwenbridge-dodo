/**
 * Session-scoped registry of emitted tool calls (tool_call_id → { name, args }).
 *
 * Some OpenAI clients omit the assistant `tool_calls` message from history and
 * send only the tool RESULT (`role: "tool"` + `tool_call_id`). Without the
 * original call in the request, the proxy cannot resolve the tool name when it
 * replays the conversation for Qwen ("Tool Response (tool): ..."). This registry
 * records every tool call the proxy EMITS (streaming and non-streaming), keyed
 * by the Qwen chat id, so the next turn can resolve the name regardless of what
 * the client sends.
 */

const bySession = new Map<string, Map<string, { name: string; args: string }>>();
const MAX_SESSIONS = 200;
const MAX_CALLS_PER_SESSION = 200;

export function recordToolCallEmission(sessionId: string, callId: string, name: string, args: string): void {
  if (!sessionId || !callId) return;
  let calls = bySession.get(sessionId);
  if (!calls) {
    if (bySession.size >= MAX_SESSIONS) {
      const oldest = bySession.keys().next().value;
      if (oldest) bySession.delete(oldest);
    }
    calls = new Map();
    bySession.set(sessionId, calls);
  }
  if (calls.size >= MAX_CALLS_PER_SESSION) {
    const oldest = calls.keys().next().value;
    if (oldest) calls.delete(oldest);
  }
  calls.set(callId, { name, args });
}

export function lookupToolCall(sessionId: string, callId: string): { name: string; args: string } | undefined {
  return bySession.get(sessionId)?.get(callId);
}

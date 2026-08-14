/**
 * Tool-call emission debug capture. Records the exact `data: ...` chunks the
 * proxy emits for tool calls (streaming and non-streaming) into a ring buffer
 * so the admin endpoint /api/debug/toolcalls can show what actually reaches
 * the client. Set QWEN_DEBUG_TOOLCALLS=true to also mirror them to the console.
 */

interface ToolCallRecord {
  ts: number;
  streamId: string;
  kind: 'streaming' | 'non-streaming';
  chunk: string;
}

const records: ToolCallRecord[] = [];
const MAX_RECORDS = 60;

export function recordToolCall(streamId: string, kind: 'streaming' | 'non-streaming', chunk: string): void {
  records.push({ ts: Date.now(), streamId, kind, chunk });
  if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
  if (process.env.QWEN_DEBUG_TOOLCALLS === 'true') {
    console.log(`[ToolCall] ${kind} stream=${streamId}\n${chunk}`);
  }
}

export function getRecentToolCalls(): ToolCallRecord[] {
  return records.slice();
}

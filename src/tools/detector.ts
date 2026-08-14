import { robustParseJSON } from '../utils/json.js';

export interface DetectedTool {
  raw: string;
  extracted: Record<string, unknown>;
}

const TOOL_CALL_REGEX = /\b[^>]*>([\s\S]*?)<\/tool_call>/gi;

export function detectToolCalls(text: string): DetectedTool[] {
  const results: DetectedTool[] = [];

  let match;
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const content = match[1].trim();
    const parsed = robustParseJSON(content);
    if (parsed && typeof parsed === 'object') {
      results.push({ raw, extracted: parsed });
    } else {
      results.push({ raw, extracted: { _rawContent: content } });
    }
  }

  if (results.length === 0) {
    const parsed = robustParseJSON(text);
    if (parsed && typeof parsed === 'object') {
      if (
        'name' in parsed ||
        'tool' in parsed ||
        'function' in parsed ||
        'function_call' in parsed
      ) {
        results.push({ raw: text.trim(), extracted: parsed });
      }
    }
  }

  return results;
}

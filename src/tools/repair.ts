export interface RepairedTool {
  name: string;
  arguments: unknown;
}

export function repairToolCall(extracted: Record<string, unknown>): RepairedTool | null {
  if ('tool' in extracted && !('name' in extracted)) {
    return {
      name: String(extracted.tool),
      arguments: extracted.arguments || {},
    };
  }

  if ('function' in extracted && typeof extracted.function === 'object' && extracted.function !== null) {
    const fn = extracted.function as Record<string, unknown>;
    if ('name' in fn) {
      return {
        name: String(fn.name),
        arguments: fn.arguments || {},
      };
    }
  }

  if ('function_call' in extracted && typeof extracted.function_call === 'object' && extracted.function_call !== null) {
    const fn = extracted.function_call as Record<string, unknown>;
    if ('name' in fn) {
      return {
        name: String(fn.name),
        arguments: fn.arguments || {},
      };
    }
  }

  if ('name' in extracted) {
    return {
      name: String(extracted.name),
      arguments: extracted.arguments || {},
    };
  }

  return null;
}

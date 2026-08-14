import { getModelTokenDivisor } from '../core/model-registry.js'
import { countTokens } from '../core/tokenizer.js'

export interface TruncatedMessage {
  role: string
  content: string
  tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string | Record<string, unknown> } }>
  name?: string
  tool_call_id?: string
}

export function estimateTokenCount(text: string, modelId?: string): number {
  const divisor = getModelTokenDivisor(modelId)
  return countTokens(text, divisor)
}

function truncateSemantically(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  
  const truncated = content.slice(0, maxChars);
  
  if (truncated.trimStart().startsWith('{') || truncated.trimStart().startsWith('[')) {
    const lastBrace = Math.max(truncated.lastIndexOf('}'), truncated.lastIndexOf(']'));
    if (lastBrace > maxChars * 0.7) {
      return truncated.slice(0, lastBrace + 1) + ' /* truncated */';
    }
  }
  
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.8) {
    return truncated.slice(0, lastNewline) + '\n[Truncated]';
  }
  
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.9) {
    return truncated.slice(0, lastSpace) + '... [Truncated]';
  }
  
  return truncated + '... [Truncated]';
}

const TOOL_MEMORY_MAX_ITEMS = 24;
const TOOL_MEMORY_ITEM_MAX_CHARS = 180;

function summarizeContent(content: string, maxChars = TOOL_MEMORY_ITEM_MAX_CHARS): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}... [truncated]`;
}

function stringifyToolArgs(args: unknown): string {
  try {
    return summarizeContent(JSON.stringify(args), 220);
  } catch {
    return summarizeContent(String(args), 220);
  }
}

function buildToolMemory(messages: Array<{ role: string; content: string | null | any[] | Record<string, unknown>; tool_calls?: any[]; name?: string; tool_call_id?: string }>, cutoffIndex: number): string {
  const lines: string[] = [];

  for (let i = 0; i < cutoffIndex; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const call of msg.tool_calls) {
        const name = call?.function?.name || call?.name || 'unknown_tool';
        let args: unknown = {};
        if (typeof call?.function?.arguments === 'string') {
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = call.function.arguments;
          }
        } else if (call?.function?.arguments !== undefined) {
          args = call.function.arguments;
        }
        lines.push(`- call ${call.id || 'unknown'}: ${name}(${stringifyToolArgs(args)})`);
        if (lines.length >= TOOL_MEMORY_MAX_ITEMS) return lines.join('\n');
      }
    }

    if (msg.role === 'tool' || msg.role === 'function') {
      const contentStr = Array.isArray(msg.content)
        ? msg.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
        : typeof msg.content === 'object' && msg.content !== null
          ? JSON.stringify(msg.content)
          : msg.content || '';
      const toolName = msg.name || msg.tool_call_id || 'tool';
      lines.push(`- ${toolName} response: ${summarizeContent(contentStr)}`);
      if (lines.length >= TOOL_MEMORY_MAX_ITEMS) return lines.join('\n');
    }
  }

  return lines.join('\n');
}

function stringifyContent(content: string | null | any[] | Record<string, unknown>): string {
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
  }
  if (typeof content === 'object' && content !== null) {
    return JSON.stringify(content);
  }
  return content || '';
}

interface MessageGroup {
  messages: Array<{ role: string; content: string; tool_calls?: any[]; name?: string; tool_call_id?: string }>;
  totalTokens: number;
}

function buildAtomicGroups(
  normalized: Array<{ role: string; content: string; tool_calls?: any[]; name?: string; tool_call_id?: string }>,
  modelId?: string
): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < normalized.length) {
    const msg = normalized[i];

    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const groupMsgs = [msg];
      let tokens = estimateTokenCount(msg.content, modelId);
      i++;

      while (i < normalized.length && (normalized[i].role === 'tool' || normalized[i].role === 'function')) {
        groupMsgs.push(normalized[i]);
        tokens += estimateTokenCount(normalized[i].content, modelId);
        i++;
      }

      groups.push({ messages: groupMsgs, totalTokens: tokens });
    } else if (msg.role === 'tool' || msg.role === 'function') {
      const groupMsgs = [msg];
      let tokens = estimateTokenCount(msg.content, modelId);
      i++;

      while (i < normalized.length && (normalized[i].role === 'tool' || normalized[i].role === 'function')) {
        groupMsgs.push(normalized[i]);
        tokens += estimateTokenCount(normalized[i].content, modelId);
        i++;
      }

      groups.push({ messages: groupMsgs, totalTokens: tokens });
    } else {
      groups.push({ messages: [msg], totalTokens: estimateTokenCount(msg.content, modelId) });
      i++;
    }
  }

  return groups;
}

export function truncateMessages(
  messages: Array<{ role: string; content: string | null | any[] | Record<string, unknown>; tool_calls?: any[]; name?: string; tool_call_id?: string }>,
  maxContextLength: number,
  systemPrompt: string = '',
  modelId?: string
): TruncatedMessage[] {
  const divisor = getModelTokenDivisor(modelId)
  const systemTokens = estimateTokenCount(systemPrompt, modelId);
  const availableTokens = maxContextLength - systemTokens - 500;
  
  if (availableTokens <= 0) {
    return [{ role: 'user', content: systemPrompt }];
  }
  
  const normalizedMessages = messages.map(msg => {
    const contentStr = stringifyContent(msg.content);
    return {
      role: msg.role,
      content: contentStr,
      tool_calls: msg.tool_calls,
      name: msg.name,
      tool_call_id: msg.tool_call_id,
    };
  });

  const groups = buildAtomicGroups(normalizedMessages, modelId);

  const keptGroups: MessageGroup[] = [];
  let usedTokens = 0;
  let droppedToolMemory = '';

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];

    if (usedTokens + group.totalTokens <= availableTokens) {
      keptGroups.push(group);
      usedTokens += group.totalTokens;
    } else {
      const remainingTokens = availableTokens - usedTokens;
      if (remainingTokens > 100) {
        const maxChars = Math.floor(remainingTokens * divisor);
        const lastMsg = group.messages[group.messages.length - 1];
        const truncatedContent = truncateSemantically(lastMsg.content, maxChars);
        keptGroups.push({
          messages: [{ ...lastMsg, content: `[Truncated] ${truncatedContent}` }],
          totalTokens: remainingTokens,
        });
      }
      const cutoffIndex = groups.slice(0, i).reduce((sum, g) => sum + g.messages.length, 0);
      droppedToolMemory = buildToolMemory(normalizedMessages, cutoffIndex);
      break;
    }
  }

  if (keptGroups.length === 0 && normalizedMessages.length > 0) {
    const lastMsg = normalizedMessages[normalizedMessages.length - 1];
    const maxChars = Math.max(200, Math.floor(availableTokens * divisor));
    const truncatedContent = truncateSemantically(lastMsg.content, maxChars);
    keptGroups.push({
      messages: [{ ...lastMsg, content: `[Truncated] ${truncatedContent}` }],
      totalTokens: availableTokens,
    });
  }

  const keptMessages = keptGroups.reverse().flatMap(g => g.messages);

  const keptToolCallIds = new Set<string>();
  for (const msg of keptMessages) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.id) keptToolCallIds.add(tc.id);
      }
    }
  }

  const result = keptMessages.filter(msg => {
    if (msg.role === 'tool' || msg.role === 'function') {
      if (msg.tool_call_id && !keptToolCallIds.has(msg.tool_call_id)) return false;
    }
    return true;
  });

  if (!droppedToolMemory) return result;
  return [{ role: 'user', content: `[Earlier tool memory]\n${droppedToolMemory}` }, ...result];
}

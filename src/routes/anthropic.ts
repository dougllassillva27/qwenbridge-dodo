/*
 * File: anthropic.ts
 * Project: qwenproxy (QwenBridge fork integrated)
 * Description: Anthropic Messages API adapter layer
 */

import { Context } from 'hono';
import { stream as honoStream } from 'hono/streaming';
import { v4 as uuidv4 } from 'uuid';
import { updateSessionParent, deleteQwenChat, updateLogicalThreadState } from '../services/qwen.js';
import { StreamingToolParser } from '../tools/parser.js';
import { robustParseJSON } from '../utils/json.js';
import { getIncrementalDelta } from './chat/helpers.js';
import { parseQwenErrorPayload } from './chat/errors.js';
import { acquireUpstreamStream } from './chat/account.js';
import crypto from "crypto";

export function getSessionSignature(messages: any[]): string {
  const hash = crypto.createHash("sha256");
  for (const m of messages) {
    let text = "";
    if (typeof m.content === "string") {
      text = m.content;
    } else if (Array.isArray(m.content)) {
      text = m.content.map((b: any) => b.text || "").join("");
    }
    hash.update(m.role + text);
  }
  return hash.digest("hex").slice(0, 16);
}

import { buildToolInstructions } from '../tools/instructions.js';

function buildPromptFromAnthropic(body: any): string {
  let systemPrompt = '';
  if (body.system) {
    if (Array.isArray(body.system)) {
      systemPrompt = body.system.map((b: any) => b.text || '').join('\n') + '\n\n';
    } else {
      systemPrompt = body.system + '\n\n';
    }
  }

  let prompt = '';
  const messages = body.messages || [];
  
  for (const msg of messages) {
    let contentStr = '';
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          contentStr += block.text + '\n';
        } else if (block.type === 'tool_result') {
          let toolResultStr = '';
          if (typeof block.content === 'string') {
            toolResultStr = block.content;
          } else if (Array.isArray(block.content)) {
            toolResultStr = block.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
          } else if (block.content) {
            toolResultStr = JSON.stringify(block.content);
          }
          contentStr += `Tool Response (${block.tool_use_id}): ${toolResultStr}\n`;
        } else if (block.type === 'tool_use') {
          contentStr += `\n<tool_call>{"name": "${block.name}", "arguments": ${JSON.stringify(block.input)}}</tool_call>\n`;
        } else if (block.type === 'image') {
          contentStr += '[Image attached]\n';
        }
      }
    } else {
      contentStr = msg.content || '';
    }

    if (msg.role === 'user') {
      prompt += `User: ${contentStr.trim()}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${contentStr.trim()}\n\n`;
    }
  }

  // Inject tools
  if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
    const formattedTools = body.tools.map((t: any) => {
      return {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema
      };
    });
    const toolsJson = JSON.stringify(formattedTools, null, 2);
    
    let toolChoiceObj = undefined;
    if (body.tool_choice && body.tool_choice.type === 'tool' && body.tool_choice.name) {
      toolChoiceObj = { function: { name: body.tool_choice.name } };
    }
    
    systemPrompt += buildToolInstructions(toolsJson, toolChoiceObj);
  }

  return systemPrompt ? `${systemPrompt}\n${prompt}` : prompt;
}

export async function anthropicMessages(c: Context) {
  try {
    const body = await c.req.json();
    const isStream = body.stream ?? false;
    
    console.log(`\n[Anthropic API] Recebendo requisição para modelo: ${body.model || 'default'}`);
    if (body.messages) {
      console.log(`[Anthropic API] Mensagens no histórico: ${body.messages.length}`);
    }
    const finalPrompt = buildPromptFromAnthropic(body);
    let model = body.model || 'qwen3-coder-plus';
    model = model.replace(/\[1m\]$/i, '');
    
    // Mapeamento de modelos Anthropic/Claude para Qwen
    const modelLower = model.toLowerCase();
    if (modelLower.includes('claude') || modelLower.includes('sonnet') || modelLower.includes('opus') || modelLower.includes('haiku')) {
      model = 'qwen3.7-plus-no-thinking';
    }

    const isThinkingModel = !model.includes('no-thinking');
    const isNewSession = !(body.messages || []).some((m: any) => m.role === 'assistant');

    // Build normalized message array to capture Anthropic system prompt in the signature hash
    const signatureMessages = [...(body.messages || [])];
    if (body.system) {
      let systemText = '';
      if (Array.isArray(body.system)) {
        systemText = body.system.map((b: any) => b.text || '').join('\n');
      } else {
        systemText = body.system;
      }
      signatureMessages.unshift({ role: 'system', content: systemText });
    }
    const sessionSignature = getSessionSignature(signatureMessages);

    const streamResult = await acquireUpstreamStream({
      finalPrompt,
      fullPrompt: finalPrompt,
      isThinkingModel,
      model,
      shouldResetUpstreamThread: false,
      allFiles: [],
      isNewSession,
      sessionId: sessionSignature,
      useThreadNative: true, // Super-fast mode!
      updateLogicalThread: true,
      forceNewChat: false,
      allowThreadReuse: true,
    });

    if ('error' in streamResult) {
      if (streamResult.allOnCooldown) {
        throw new Error(`All accounts on cooldown. Retry in ${streamResult.retryAfterMs}ms.`);
      }
      throw streamResult.error;
    }

    const stream = streamResult.stream;
    const uiSessionId = streamResult.uiSessionId;
    const activeAccountId = streamResult.activeAccountId;
    const messageId = 'msg_' + uuidv4().replace(/-/g, '');

    const resetUserSession = (sig: string) => {
      updateLogicalThreadState(sig, {
         accountId: activeAccountId,
         chatSessionId: "", // Forces new chat on retry
         parentId: null,
         instructionsSent: false
      });
    };

    if (!isStream) {
      // Non-streaming logic
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let fullReasoning = '';
      let lastParentId = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const text = line.trim();
            if (!text || text.startsWith(':')) continue;

            const errorPayload = parseQwenErrorPayload(text);
            if (errorPayload) {
              const errMsg = errorPayload.message;
              const isContextOverflow = errMsg.includes('input length') || errMsg.includes('Range of input') || errMsg.includes('context length') || errMsg.includes('token limit');
              if (isContextOverflow) {
                resetUserSession(sessionSignature);
              }
              throw new Error(errMsg);
            }

            if (text === 'data: [DONE]') break;
            
            if (text.startsWith('data: ')) {
              let chunk: any;
              try {
                chunk = JSON.parse(text.slice(6));
              } catch (e) {
                continue;
              }

              if (chunk.error) {
                const errMsg = chunk.error.message || chunk.error.details || JSON.stringify(chunk.error);
                const isContextOverflow = errMsg.includes('input length') || errMsg.includes('Range of input') || errMsg.includes('context length') || errMsg.includes('token limit');
                if (isContextOverflow) {
                  resetUserSession(sessionSignature);
                }
                throw new Error(`Qwen API error: ${errMsg}`);
              }
              const delta = chunk.choices?.[0]?.delta;
              if (!delta) continue;
              
              if (chunk.response_id) lastParentId = chunk.response_id;
              
              if (delta.phase === 'thinking_summary' && delta.extra?.summary_thought?.content) {
                fullReasoning += delta.extra.summary_thought.content.join('');
              } else if ((delta.phase === 'answer' || delta.phase === undefined) && delta.content) {
                const incr = getIncrementalDelta(fullContent, delta.content);
                fullContent += incr.delta;
              }
            }
          }
        }
      } catch (err) {
        try { await reader.cancel(); } catch (_) {}
        throw err;
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }

      if (lastParentId) updateSessionParent(uiSessionId, lastParentId, activeAccountId);

      const toolParser = new StreamingToolParser();
      const parsedContent = toolParser.feed(fullContent);
      const flushResult = toolParser.flush();
      const finalContentText = parsedContent.text + flushResult.text;
      const toolCalls = [...parsedContent.toolCalls, ...flushResult.toolCalls];

      const contentBlocks = [];
      if (fullReasoning) {
        contentBlocks.push({ type: 'thinking', thinking: fullReasoning, signature: 'WaUjzkypQ2mUEVM36' });
      }
      if (finalContentText.trim()) {
        contentBlocks.push({ type: 'text', text: finalContentText.trim() });
      }
      for (const tc of toolCalls) {
        contentBlocks.push({ type: 'tool_use', id: 'toolu_' + uuidv4().slice(0, 8), name: tc.name, input: tc.arguments });
      }

      if (contentBlocks.length === 0) {
        contentBlocks.push({ type: 'text', text: '' });
      }

      return c.json({
        id: messageId,
        type: 'message',
        role: 'assistant',
        model: model,
        content: contentBlocks,
        stop_reason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: Math.ceil(finalPrompt.length / 3.5), output_tokens: Math.ceil(fullContent.length / 3.5) }
      });
    }

    // Streaming logic
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return honoStream(c, async (streamWriter) => {
      const writeEvent = async (event: string, data: any) => {
        await streamWriter.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const reader = stream.getReader();
      try {
        await writeEvent('message_start', {
          type: 'message_start',
          message: {
            id: messageId, type: 'message', role: 'assistant', model, content: [],
            stop_reason: null, stop_sequence: null,
            usage: { input_tokens: Math.ceil(finalPrompt.length / 3.5), output_tokens: 0 }
          }
        });
        await writeEvent('ping', { type: 'ping' });

        let blockIndex = 0;
        let isThinkingActive = false;
        let isTextActive = false;
        let emittedAnswer = false;
        let lastParentId = null;
        let outputTokens = 0;

        const toolParser = new StreamingToolParser();

        const decoder = new TextDecoder();
        let buffer = '';
        let oldFullContent = '';
        let oldReasoningContent = '';

        while (true) {
          if (c.req.raw.signal?.aborted) {
            throw new Error('Client aborted connection');
          }
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const text = line.trim();
            if (!text || text.startsWith(':')) continue;

            if (text === 'data: [DONE]') break;

            const errorPayload = parseQwenErrorPayload(text);
            if (errorPayload) {
              console.error(`[Qwen] Upstream error in stream: ${errorPayload.message}`);
              throw new Error(`Upstream error: ${errorPayload.message}`);
            }

            if (text.startsWith('data: ')) {
              let chunk: any;
              try {
                chunk = JSON.parse(text.slice(6));
              } catch (e) {
                continue;
              }

              if (chunk.error) {
                const errMsg = chunk.error.message || chunk.error.details || JSON.stringify(chunk.error);
                console.warn(`[Qwen] Stream chunk warning/error: ${errMsg}`);
                if (errMsg.includes('segurança de conteúdo') || errMsg.includes('safety') || errMsg.includes('inadequado')) {
                  if (isThinkingActive) {
                    await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                    isThinkingActive = false;
                    blockIndex++;
                  }
                  if (!isTextActive) {
                    await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
                    isTextActive = true;
                  }
                  await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: `\n\n[Qwen Safety Warning: ${errMsg}]` } });
                  break;
                }
                throw new Error(`Stream chunk error: ${errMsg}`);
              }
              const delta = chunk.choices?.[0]?.delta;
              if (!delta) continue;

              if (chunk.response_id) lastParentId = chunk.response_id;
              if (chunk.usage?.output_tokens) outputTokens = chunk.usage.output_tokens;

              // Handle Thinking
              if (delta.phase === 'thinking_summary' && delta.extra?.summary_thought?.content) {
                const fullReasoning = delta.extra.summary_thought.content.join('');
                const diff = getIncrementalDelta(oldReasoningContent, fullReasoning);
                oldReasoningContent += diff.delta;
                
                if (diff.delta) {
                  if (!isThinkingActive) {
                    await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'thinking', thinking: '' } });
                    isThinkingActive = true;
                  }
                  await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'thinking_delta', thinking: diff.delta } });
                }
              }

              // End Thinking and Start Answer
              if ((delta.phase === 'answer' || delta.phase === undefined) && isThinkingActive) {
                await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'signature_delta', signature: 'WaUjzkypQ2mUEVM' } });
                await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                isThinkingActive = false;
                blockIndex++;
              }

              // Handle Text/Tools
              if ((delta.phase === 'answer' || delta.phase === undefined) && delta.content) {
                const diff = getIncrementalDelta(oldFullContent, delta.content);
                oldFullContent += diff.delta;

                if (diff.delta) {
                  const parseRes = toolParser.feed(diff.delta);
                  
                  if (parseRes.text) {
                    if (!isTextActive && !toolParser.isInsideTool()) {
                      await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
                      isTextActive = true;
                      emittedAnswer = true;
                    }
                    if (isTextActive) {
                      await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: parseRes.text } });
                    }
                  }

                  // Flush tools dynamically if detected
                  for (const tc of parseRes.toolCalls) {
                    if (isTextActive) {
                      await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                      isTextActive = false;
                      blockIndex++;
                    }
                    await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'tool_use', id: 'toolu_' + tc.id, name: tc.name, input: {} } });
                    emittedAnswer = true;
                    await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'input_json_delta', partial_json: JSON.stringify(tc.arguments) } });
                    await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                    blockIndex++;
                  }
                }
              }
            }
          }
        }

        // Flush remaining tools
        const flushRes = toolParser.flush();
        if (flushRes.text) {
           if (!isTextActive && !toolParser.isInsideTool()) {
              await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
              isTextActive = true;
              emittedAnswer = true;
           }
           if (isTextActive) {
              await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: flushRes.text } });
           }
        }
        for (const tc of flushRes.toolCalls) {
          if (isTextActive) {
            await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
            isTextActive = false;
            blockIndex++;
          }
          await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'tool_use', id: 'toolu_' + tc.id, name: tc.name, input: {} } });
          emittedAnswer = true;
          await writeEvent('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'input_json_delta', partial_json: JSON.stringify(tc.arguments) } });
          await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
          blockIndex++;
        }

        if (isThinkingActive) {
          await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
          isThinkingActive = false;
          blockIndex++;
        }

        if (isTextActive) {
          await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
          isTextActive = false;
          blockIndex++;
        }

        if (!emittedAnswer) {
          await writeEvent('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
          await writeEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
          blockIndex++;
        }

        if (lastParentId) updateSessionParent(uiSessionId, lastParentId, activeAccountId);

        const hasTools = toolParser.getEmittedToolCallCount() > 0;
        await writeEvent('message_delta', { type: 'message_delta', delta: { stop_reason: hasTools ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: outputTokens || Math.ceil(oldFullContent.length / 3.5) } });
        await writeEvent('message_stop', { type: 'message_stop' });
      } catch (err: any) {
        const errMsg = err.message || '';
        if (c.req.raw.signal?.aborted || errMsg === 'Client aborted connection') {
          console.warn('[Server] Client aborted connection during streaming.');
        } else {
          console.error('Error during streaming in anthropicMessages:', err);
        }
        const isContextOverflow = errMsg.includes('input length') || errMsg.includes('Range of input') || errMsg.includes('context length') || errMsg.includes('token limit');
        if (isContextOverflow) {
          resetUserSession(sessionSignature);
        }
        if (!c.req.raw.signal?.aborted) {
          try {
            await writeEvent('error', {
              type: 'error',
              error: {
                type: 'api_error',
                message: `QwenProxy Error: ${errMsg}`
              }
            });
          } catch (writeErr) {
            console.error('Failed to write error event to stream:', writeErr);
          }
        }
      } finally {
        try { await reader.cancel(); } catch (_) {}
        try { reader.releaseLock(); } catch (_) {}
        await streamWriter.close();
      }
    });

  } catch (error: any) {
    console.error('Anthropic API Error:', error);
    return c.json({ type: 'error', error: { type: 'api_error', message: error.message } }, 500);
  }
}

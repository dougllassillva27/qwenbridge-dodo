import test from "node:test";
import assert from "node:assert";

process.env.TEST_MOCK_QWEN_AUTH = "true";

import {
  translateAnthropicToOpenAI,
  translateOpenAIToAnthropic,
  mapAnthropicModel,
  translateStreamChunk,
} from "../routes/anthropic/translate.js";
import { validateAnthropicRequest } from "../routes/anthropic/validation.js";

test("Anthropic: mapAnthropicModel maps correctly", () => {
  // Opus maps to qwen3.7-plus (with thinking)
  assert.strictEqual(mapAnthropicModel("claude-3-5-opus"), "qwen3.7-plus");
  assert.strictEqual(mapAnthropicModel("claude-opus-4-6"), "qwen3.7-plus");

  // Sonnet, Haiku and others map to qwen3.7-plus-no-thinking
  assert.strictEqual(mapAnthropicModel("claude-sonnet-4-6"), "qwen3.7-plus-no-thinking");
  assert.strictEqual(mapAnthropicModel("claude-3-5-sonnet"), "qwen3.7-plus-no-thinking");
  assert.strictEqual(mapAnthropicModel("claude-haiku-4-5"), "qwen3.7-plus-no-thinking");
  assert.strictEqual(mapAnthropicModel("unknown-model"), "qwen3.7-plus-no-thinking");
});

test("Anthropic: translateAnthropicToOpenAI converts messages", () => {
  const anthropicReq = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You are helpful",
    messages: [{ role: "user" as const, content: "Hello" }],
  };

  const result = translateAnthropicToOpenAI(anthropicReq);

  assert.strictEqual(result.model, "qwen3.7-plus-no-thinking");
  assert.strictEqual(result.max_tokens, 1024);
  assert.strictEqual(result.messages.length, 2);
  assert.strictEqual(result.messages[0].role, "system");
  assert.strictEqual(result.messages[0].content, "You are helpful");
  assert.strictEqual(result.messages[1].role, "user");
  assert.strictEqual(result.messages[1].content, "Hello");
});

test("Anthropic: translateOpenAIToAnthropic converts response with reasoning", () => {
  const openaiResponse = {
    id: "chatcmpl-123",
    object: "chat.completion" as const,
    created: Date.now(),
    model: "qwen3.7-plus",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: "Hello! How can I help?",
          reasoning_content: "Thinking step by step...",
        },
        finish_reason: "stop" as const,
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };

  const result = translateOpenAIToAnthropic(
    openaiResponse,
    "claude-opus-4-6",
  );

  assert.strictEqual(result.type, "message");
  assert.strictEqual(result.role, "assistant");
  assert.strictEqual(result.model, "claude-opus-4-6");
  assert.strictEqual(result.stop_reason, "end_turn");
  assert.strictEqual(result.content.length, 2);
  
  // First content block should be thinking/reasoning
  assert.strictEqual(result.content[0].type, "thinking");
  assert.strictEqual(result.content[0].thinking, "Thinking step by step...");

  // Second content block should be text
  assert.strictEqual(result.content[1].type, "text");
  assert.strictEqual(result.content[1].text, "Hello! How can I help?");
});

test("Anthropic: translateStreamChunk handles reasoning_content", () => {
  const state = {
    contentBlockIndex: 0,
    currentBlockType: null as string | null,
    requestModel: "claude-opus-4-6",
    inputTokens: 0,
  };

  // Chunk 1: Reasoning content delta
  const chunk1 = {
    choices: [
      {
        delta: {
          reasoning_content: "Thinking ",
        },
      },
    ],
  };

  const events1 = translateStreamChunk(chunk1, state);
  assert.strictEqual(events1.length, 2);
  
  const ev1 = JSON.parse(events1[0]);
  assert.strictEqual(ev1.type, "content_block_start");
  assert.strictEqual(ev1.content_block.type, "thinking");
  
  const ev2 = JSON.parse(events1[1]);
  assert.strictEqual(ev2.type, "content_block_delta");
  assert.strictEqual(ev2.delta.type, "thinking_delta");
  assert.strictEqual(ev2.delta.thinking, "Thinking ");

  // Chunk 2: More reasoning
  const chunk2 = {
    choices: [
      {
        delta: {
          reasoning_content: "hard...",
        },
      },
    ],
  };

  const events2 = translateStreamChunk(chunk2, state);
  assert.strictEqual(events2.length, 1);
  const ev3 = JSON.parse(events2[0]);
  assert.strictEqual(ev3.type, "content_block_delta");
  assert.strictEqual(ev3.delta.type, "thinking_delta");
  assert.strictEqual(ev3.delta.thinking, "hard...");

  // Chunk 3: Transition to content
  const chunk3 = {
    choices: [
      {
        delta: {
          content: "Hello!",
        },
      },
    ],
  };

  const events3 = translateStreamChunk(chunk3, state);
  assert.strictEqual(events3.length, 3);
  
  // First event should close the thinking block
  const ev4 = JSON.parse(events3[0]);
  assert.strictEqual(ev4.type, "content_block_stop");
  assert.strictEqual(ev4.index, 0);

  // Second event should start the text block
  const ev5 = JSON.parse(events3[1]);
  assert.strictEqual(ev5.type, "content_block_start");
  assert.strictEqual(ev5.index, 1);
  assert.strictEqual(ev5.content_block.type, "text");

  // Third event should send the text delta
  const ev6 = JSON.parse(events3[2]);
  assert.strictEqual(ev6.type, "content_block_delta");
  assert.strictEqual(ev6.index, 1);
  assert.strictEqual(ev6.delta.type, "text_delta");
  assert.strictEqual(ev6.delta.text, "Hello!");
});

test("Anthropic: validateAnthropicRequest accepts valid request", () => {
  const validReq = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }],
  };

  const result = validateAnthropicRequest(validReq);
  assert.strictEqual(result.valid, true);
});

test("Anthropic: validateAnthropicRequest rejects missing model", () => {
  const invalidReq = {
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello" }],
  };

  const result = validateAnthropicRequest(invalidReq);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error?.includes("model"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateAnthropicTokens,
  translateOpenAIToAnthropic,
  translateStreamChunk,
} from "../routes/anthropic/translate.ts";
import type { AnthropicRequest, OpenAIResponse } from "../routes/anthropic/types.ts";

test("estimateAnthropicTokens calculates tokens for system, messages and tools", () => {
  const request: AnthropicRequest = {
    model: "qwen3.8-max-thinking",
    max_tokens: 1000,
    system: "You are a helpful coding assistant.",
    messages: [
      {
        role: "user",
        content: "Write a quicksort algorithm in TypeScript.",
      },
      {
        role: "assistant",
        content: "Here is the implementation of quicksort in TypeScript...",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Now add unit tests." },
          {
            type: "tool_result",
            tool_use_id: "call_123",
            content: "File updated successfully.",
          },
        ],
      },
    ],
    tools: [
      {
        name: "view_file",
        description: "View file contents",
        input_schema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ],
  };

  const tokens = estimateAnthropicTokens(request);
  assert.ok(tokens > 30, `Expected token count > 30, got ${tokens}`);
});

test("translateOpenAIToAnthropic falls back to estimated input and completion tokens", () => {
  const request: AnthropicRequest = {
    model: "qwen3.8-max-thinking",
    max_tokens: 1000,
    messages: [{ role: "user", content: "Hello world!" }],
  };

  const mockOpenAIResponse: OpenAIResponse = {
    id: "chatcmpl-123",
    object: "chat.completion",
    created: Date.now(),
    model: "qwen3.8-max",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! How can I assist you today?",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };

  const response = translateOpenAIToAnthropic(
    mockOpenAIResponse,
    "qwen3.8-max-thinking",
    request,
  );

  assert.ok(response.usage.input_tokens > 0, `Expected input_tokens > 0, got ${response.usage.input_tokens}`);
  assert.ok(response.usage.output_tokens > 0, `Expected output_tokens > 0, got ${response.usage.output_tokens}`);
});

test("translateStreamChunk accumulates outputTokens from content and reasoning", () => {
  const state = {
    contentBlockIndex: 0,
    currentBlockType: null as string | null,
    requestModel: "qwen3.8-max-thinking",
    inputTokens: 120,
    outputTokens: 0,
  };

  // Thinking delta
  const chunk1 = {
    choices: [
      {
        delta: { reasoning_content: "Let me think about how to solve this." },
      },
    ],
  };
  translateStreamChunk(chunk1, state);
  assert.ok(state.outputTokens > 0, "outputTokens should increase after reasoning delta");

  // Content delta
  const previousTokens = state.outputTokens;
  const chunk2 = {
    choices: [
      {
        delta: { content: "Here is the final answer." },
      },
    ],
  };
  translateStreamChunk(chunk2, state);
  assert.ok(state.outputTokens > previousTokens, "outputTokens should increase after content delta");

  // Finish reason
  const finishChunk = {
    choices: [
      {
        delta: {},
        finish_reason: "stop",
      },
    ],
  };
  const finishEvents = translateStreamChunk(finishChunk, state);
  const messageDeltaEvent = finishEvents.find((e) => JSON.parse(e).type === "message_delta");
  assert.ok(messageDeltaEvent, "message_delta event should be emitted");

  const parsed = JSON.parse(messageDeltaEvent!);
  assert.ok(parsed.usage.output_tokens > 0, `Expected output_tokens > 0 in message_delta, got ${parsed.usage.output_tokens}`);
});

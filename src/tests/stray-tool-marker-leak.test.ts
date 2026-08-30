import test from "node:test";
import assert from "node:assert/strict";
import { StreamingToolParser } from "../tools/parser.ts";

// Regression: qwen3.8-max-thinking sometimes emits degenerate tool-call
// markers as content alongside (or instead of) structured tool calls, e.g.
// the literal text `<tool_call_>`. These used to leak to the client as
// visible assistant text (delivered to Telegram). The parser must swallow
// them. Real session evidence: Hermes state.db msg 2515
// (session 20260829_003341_49508ce0).

function runParser(chunks: string[], tools: unknown[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new StreamingToolParser(tools as any);
  let text = "";
  const toolCalls: unknown[] = [];
  for (const chunk of chunks) {
    const r = parser.feed(chunk);
    text += r.text;
    toolCalls.push(...r.toolCalls);
  }
  const flushed = parser.flush();
  text += flushed.text;
  toolCalls.push(...flushed.toolCalls);
  return { text, toolCalls };
}

test("Stray degenerate <tool_call_> marker alone is swallowed", () => {
  const { text, toolCalls } = runParser(["<tool_call_>"], [
    {
      type: "function",
      function: {
        name: "terminal",
        description: "Run a command",
        parameters: { type: "object", properties: {} },
      },
    },
  ]);
  assert.equal(text, "", "degenerate marker must not leak as visible text");
  assert.equal(toolCalls.length, 0);
});

test("Stray marker streamed before a valid tool call does not leak", () => {
  const tools = [
    {
      type: "function",
      function: {
        name: "terminal",
        description: "Run a command",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    },
  ];
  // Degenerate marker first, then a well-formed call split across chunks.
  const { text, toolCalls } = runParser(
    [
      "<tool_call_>",
      "<tool_call_terminal>",
      '{"name":"terminal","arguments":{"command":"uptime"}}',
      "</tool_call_terminal>",
    ],
    tools,
  );
  assert.ok(
    !text.includes("tool_call"),
    `no marker fragment may leak, got: ${JSON.stringify(text)}`,
  );
  assert.equal(toolCalls.length, 1, "the valid tool call must still parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((toolCalls[0] as any).name, "terminal");
});

test("Stray markers with quote/underscore variants are swallowed", () => {
  for (const marker of [
    '<tool_call">',
    "<tool_call_ >",
    "</tool_call_calls>",
    "<|tool_call_end|>",
    "&lt;tool_call_&gt;",
  ]) {
    const { text } = runParser([`Antes ${marker} depois`]);
    assert.ok(
      !text.includes("tool_call"),
      `marker ${marker} leaked: ${JSON.stringify(text)}`,
    );
    assert.ok(text.includes("Antes"), "surrounding prose must survive");
    assert.ok(text.includes("depois"), "surrounding prose must survive");
  }
});

test("Lead-in text before a tool call is cleaned of stray markers", () => {
  const tools = [
    {
      type: "function",
      function: {
        name: "terminal",
        description: "Run a command",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    },
  ];
  // Lead-in prose containing a stray marker, then a valid call. If the call
  // fails to parse downstream the lead-in can be restored; it must be clean.
  const { text } = runParser(
    [
      "Vou verificar. <tool_call_>\n",
      "<tool_call_terminal>",
      '{"name":"terminal","arguments":{"command":"docker ps"}}',
      "</tool_call_terminal>",
    ],
    tools,
  );
  assert.ok(
    !text.includes("tool_call"),
    `lead-in marker leaked: ${JSON.stringify(text)}`,
  );
});

test("Legit prose quoting the marker syntax without a full tag survives", () => {
  const { text } = runParser([
    "O parser remove fragmentos `" + "<tool_call` órfãos do texto.",
  ]);
  assert.ok(
    text.includes("<tool_call"),
    "backtick-quoted partial tag (no '>') is legit prose and must survive",
  );
});

test("Named opening tag inside a markdown code fence is preserved", () => {
  const payload = "Exemplo de sintaxe:\n```\n<tool_call_terminal>\n```";
  const { text } = runParser([payload]);
  assert.ok(
    text.includes("<tool_call_terminal>"),
    "named tag inside code fence is documentation, not a leak",
  );
});

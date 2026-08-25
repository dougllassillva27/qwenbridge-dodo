import test from "node:test";
import assert from "node:assert";
import { StreamingToolParser } from "../tools/parser.ts";

const tools = [
  {
    type: "function" as const,
    function: {
      name: "ToolSearch",
      description: "Search tools",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          max_results: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "PowerShell",
      description: "Run powershell command",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
];

test("Log repro: consecutive tool calls with missing outer closing brace in stream", () => {
  const parser = new StreamingToolParser(tools);
  const input = `<tool_call>
{"name": "ToolSearch", "arguments": {"query": "select:mcp__mcp-datetimeday__get_datetime", "max_results": 1}
</tool_call>
<tool_call>
{"name": "PowerShell", "arguments": {"command": "rtk powershell -Command \\"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Force | Select-Object Mode, LastWriteTime, Length, Name | Format-Table -AutoSize\\"", "description": "Listar conteúdo do diretório do projeto"}
`;
  const res1 = parser.feed(input);
  const res2 = parser.flush();
  const allCalls = [...res1.toolCalls, ...res2.toolCalls];

  assert.strictEqual(parser.getMalformedToolCalls().length, 0);
  assert.strictEqual(allCalls.length, 2);
  assert.strictEqual(allCalls[0].name, "ToolSearch");
  assert.strictEqual(
    (allCalls[0].arguments as any).query,
    "select:mcp__mcp-datetimeday__get_datetime",
  );
  assert.strictEqual((allCalls[0].arguments as any).max_results, 1);
  assert.strictEqual(allCalls[1].name, "PowerShell");
  assert.ok(
    typeof (allCalls[1].arguments as any).command === "string" &&
      (allCalls[1].arguments as any).command.includes("Get-ChildItem"),
  );
});

test("Consecutive tool calls where closing </tool_call> tag is omitted between calls", () => {
  const parser = new StreamingToolParser(tools);
  const input = `<tool_call>
{"name": "ToolSearch", "arguments": {"query": "select:time", "max_results": 5}}
<tool_call>
{"name": "PowerShell", "arguments": {"command": "dir", "description": "list files"}}
</tool_call>`;

  const res1 = parser.feed(input);
  const res2 = parser.flush();
  const allCalls = [...res1.toolCalls, ...res2.toolCalls];

  assert.strictEqual(parser.getMalformedToolCalls().length, 0);
  assert.strictEqual(allCalls.length, 2);
  assert.strictEqual(allCalls[0].name, "ToolSearch");
  assert.strictEqual(allCalls[1].name, "PowerShell");
});

test("Single tool call with missing outer closing brace and proper closing tag", () => {
  const parser = new StreamingToolParser(tools);
  const input = `<tool_call>{"name": "ToolSearch", "arguments": {"query": "my_query"}}</tool_call>`;
  // Missing outer brace before </tool_call>:
  const inputMissingOuter = `<tool_call>{"name": "ToolSearch", "arguments": {"query": "my_query"}</tool_call>`;

  const res = parser.feed(inputMissingOuter);
  const flushed = parser.flush();
  const allCalls = [...res.toolCalls, ...flushed.toolCalls];

  assert.strictEqual(parser.getMalformedToolCalls().length, 0);
  assert.strictEqual(allCalls.length, 1);
  assert.strictEqual(allCalls[0].name, "ToolSearch");
  assert.strictEqual((allCalls[0].arguments as any).query, "my_query");
});

test("Genuinely truncated payload ending mid-value is still dropped and tracked as malformed", () => {
  const parser = new StreamingToolParser(tools);
  const input = `<tool_call>{"name": "ToolSearch", "arguments": {"query": "select:time`;

  const res = parser.feed(input);
  const flushed = parser.flush();
  const allCalls = [...res.toolCalls, ...flushed.toolCalls];

  assert.strictEqual(allCalls.length, 0);
  assert.strictEqual(parser.getMalformedToolCalls().length, 1);
  assert.strictEqual(parser.getMalformedToolCalls()[0].category, "truncated");
});

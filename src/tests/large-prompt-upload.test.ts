import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadLargePromptAsFile } from "../routes/upload.ts";
import { config } from "../core/config.ts";

test("uploadLargePromptAsFile returns null when prompt is below threshold", async () => {
  const smallPrompt = "Hello world";
  const result = await uploadLargePromptAsFile(smallPrompt, {}, "acct-test");
  assert.equal(result, null);
});

test("uploadLargePromptAsFile recognizes threshold byte boundary", async () => {
  const shortText = "a".repeat(100);
  const result = await uploadLargePromptAsFile(shortText, {}, "acct-test");
  assert.equal(result, null);
});

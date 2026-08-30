import { test } from "node:test";
import assert from "node:assert/strict";
import { isAbortedResource, setupResourceInterception } from "../services/playwright.ts";

test("isAbortedResource: allows essential web application assets", () => {
  // Document, scripts, stylesheets, XHR/Fetch, and Images must NOT be aborted
  assert.equal(isAbortedResource("https://chat.qwen.ai/", "document"), false);
  assert.equal(isAbortedResource("https://chat.qwen.ai/assets/index.js", "script"), false);
  assert.equal(isAbortedResource("https://chat.qwen.ai/assets/index.css", "stylesheet"), false);
  assert.equal(isAbortedResource("https://chat.qwen.ai/api/v2/chat/completions", "fetch"), false);
  assert.equal(isAbortedResource("https://chat.qwen.ai/api/v2/chats/new", "xhr"), false);
  
  // Images (vital for Captcha puzzle pieces and Vision models) must NOT be aborted
  assert.equal(isAbortedResource("https://g.alicdn.com/puzzle_slider.png", "image"), false);
  assert.equal(isAbortedResource("https://chat.qwen.ai/static/avatar.png", "image"), false);
});

test("isAbortedResource: aborts heavy media and webfonts", () => {
  // Video and audio files
  assert.equal(isAbortedResource("https://chat.qwen.ai/media/intro.mp4", "media"), true);
  assert.equal(isAbortedResource("https://chat.qwen.ai/audio/notification.mp3", "media"), true);

  // Heavy webfonts
  assert.equal(isAbortedResource("https://at.alicdn.com/t/font_12345.woff2", "font"), true);
  assert.equal(isAbortedResource("https://fonts.gstatic.com/s/roboto.ttf", "font"), true);
});

test("isAbortedResource: aborts analytics and tracking beacons", () => {
  // Alibaba CNZZ analytics
  assert.equal(isAbortedResource("https://s9.cnzz.com/z_stat.php?id=123", "script"), true);
  assert.equal(isAbortedResource("https://log.mmstat.com/eg.js", "script"), true);
  assert.equal(isAbortedResource("https://arms-retcode.aliyuncs.com/r.png", "image"), true);
  assert.equal(isAbortedResource("https://track.uc.cn/collect", "xhr"), true);
  assert.equal(isAbortedResource("https://chat.qwen.ai/beacon/event", "fetch"), true);

  // Third party trackers
  assert.equal(isAbortedResource("https://www.google-analytics.com/analytics.js", "script"), true);
  assert.equal(isAbortedResource("https://www.googletagmanager.com/gtm.js", "script"), true);
});

test("setupResourceInterception: sets up route handler on context", async () => {
  let registeredPattern = "";
  let interceptedHandler: ((route: any) => Promise<void>) | null = null;

  const mockContext: any = {
    route: async (pattern: string, handler: (route: any) => Promise<void>) => {
      registeredPattern = pattern;
      interceptedHandler = handler;
    },
  };

  await setupResourceInterception(mockContext);
  assert.equal(registeredPattern, "**/*");
  assert.ok(typeof interceptedHandler === "function");

  // Test route handler aborting tracking request
  let aborted = false;
  let continued = false;
  const mockTrackerRoute: any = {
    request: () => ({
      url: () => "https://log.mmstat.com/trace",
      resourceType: () => "script",
    }),
    abort: async (reason: string) => {
      assert.equal(reason, "blockedbyclient");
      aborted = true;
    },
    continue: async () => {
      continued = true;
    },
  };

  await interceptedHandler!(mockTrackerRoute);
  assert.equal(aborted, true);
  assert.equal(continued, false);

  // Test route handler allowing normal chat API request
  aborted = false;
  continued = false;
  const mockApiRoute: any = {
    request: () => ({
      url: () => "https://chat.qwen.ai/api/v2/chat/completions",
      resourceType: () => "fetch",
    }),
    abort: async () => {
      aborted = true;
    },
    continue: async () => {
      continued = true;
    },
  };

  await interceptedHandler!(mockApiRoute);
  assert.equal(aborted, false);
  assert.equal(continued, true);
});

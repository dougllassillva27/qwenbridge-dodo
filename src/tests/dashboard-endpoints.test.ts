import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardApp } from "../api/dashboard.ts";
import { logHub } from "../core/log-hub.ts";
import { markAccountRateLimited, getAccountCooldownInfo } from "../core/account-manager.ts";

test("dashboard: GET / returns 200 with HTML dashboard", async () => {
  const res = await dashboardApp.request("/");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /QwenBridge/);
  assert.match(text, /PORT 50002/);
  assert.match(text, /<!DOCTYPE html>/i);
});

test("dashboard: GET /dashboard returns 200 with HTML dashboard", async () => {
  const res = await dashboardApp.request("/dashboard");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /QwenBridge/);
});

test("dashboard: GET /api/dashboard/status returns system metrics and accounts", async () => {
  const res = await dashboardApp.request("/api/dashboard/status");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "online");
  assert.equal(typeof data.uptime, "string");
  assert.equal(typeof data.memory.rssMb, "number");
  assert.equal(data.memory.maxLimitMb, 4096);
  assert.equal(typeof data.metrics.totalRequests, "number");
  assert.equal(Array.isArray(data.accounts.list), true);
});

test("dashboard: GET /api/logs returns log array and respects limit", async () => {
  logHub.pushLog("Test log entry 1", "info");
  logHub.pushLog("Test log entry 2 [warn]", "warn");

  const res = await dashboardApp.request("/api/logs?limit=10");
  assert.equal(res.status, 200);
  const logs = await res.json();
  assert.equal(Array.isArray(logs), true);
  assert.ok(logs.length >= 2);
  assert.ok(logs.some((l: any) => l.text.includes("Test log entry 1")));
});

test("dashboard: POST /api/actions/clear-cooldown resets account cooldowns", async () => {
  const testAccId = "test-acc-dashboard-123";
  markAccountRateLimited(testAccId, 60000, "TestRateLimit", { silent: true });

  const before = getAccountCooldownInfo(testAccId);
  assert.ok(before?.onCooldown);

  const res = await dashboardApp.request("/api/actions/clear-cooldown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: testAccId }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  const after = getAccountCooldownInfo(testAccId);
  assert.equal(after, null);
});

test("dashboard: POST /api/actions/clear-cache returns success", async () => {
  const res = await dashboardApp.request("/api/actions/clear-cache", {
    method: "POST",
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

test("logHub: buffers and detects log levels correctly", () => {
  const errorItem = logHub.pushLog("❌ [Server] Fatal simulated error");
  assert.equal(errorItem.level, "error");

  const warnItem = logHub.pushLog("⚠️ [Server] Warning message");
  assert.equal(warnItem.level, "warn");

  const debugItem = logHub.pushLog("🔍 [Diag] GET /v1/models");
  assert.equal(debugItem.level, "debug");
});

test("server: GET /metrics/accounts and /accounts return account metrics with CORS", async () => {
  const { app } = await import("../api/server.ts");

  const res1 = await app.request("/metrics/accounts");
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get("access-control-allow-origin"), "*");
  const data1 = await res1.json();
  assert.equal(typeof data1.total, "number");
  assert.equal(typeof data1.active, "number");
  assert.equal(typeof data1.cooldown, "number");
  assert.equal(typeof data1.requests, "number");
  assert.equal(typeof data1.ram_mb, "number");
  assert.equal(typeof data1.stream_errors, "number");
  assert.equal(Array.isArray(data1.accounts), true);

  const res2 = await app.request("/accounts");
  assert.equal(res2.status, 200);
  assert.equal(res2.headers.get("access-control-allow-origin"), "*");

  const resOptions = await app.request("/metrics/accounts", { method: "OPTIONS" });
  assert.equal(resOptions.status, 204);
  assert.equal(resOptions.headers.get("access-control-allow-origin"), "*");
});

test("server: /api/hello and /api/version respond 200 to client probes", async () => {
  const { app } = await import("../api/server.ts");

  const resHello = await app.request("/api/hello", { method: "HEAD" });
  assert.equal(resHello.status, 200);

  const resHelloGet = await app.request("/api/hello", { method: "GET" });
  assert.equal(resHelloGet.status, 200);
  const text = await resHelloGet.text();
  assert.ok(text.includes("QwenBridge"));

  const resVer = await app.request("/api/version");
  assert.equal(resVer.status, 200);
  const json = await resVer.json();
  assert.equal(typeof json.version, "string");
});



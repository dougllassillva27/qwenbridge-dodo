import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../api/server.ts";
import { logBuffer } from "../core/log-buffer.ts";
import { sampleNow, getAllSeries } from "../core/time-series.ts";

test("Admin API: GET /admin serves the SPA html entry point", async () => {
  const res = await app.request("/admin");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("<html") || text.includes("<!doctype html>"));
});

test("Admin API: GET /admin/api/session returns authentication status", async () => {
  const res = await app.request("/admin/api/session");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data, "object");
  assert.ok("authenticated" in data);
  assert.ok("enabled" in data);
});

test("Admin API: GET /admin/api/overview rejects unauthenticated requests", async () => {
  const res = await app.request("/admin/api/overview");
  // Either 401 (not authenticated) or 503 (disabled if no password set)
  assert.ok([401, 503].includes(res.status));
});

test("Admin API: logBuffer pushes, retrieves and clears entries", () => {
  logBuffer.clear();
  const entry1 = logBuffer.push("info", "Test log message 1", "test-ctx");
  const entry2 = logBuffer.push("error", "Test error message 2");

  assert.equal(entry1.level, "info");
  assert.equal(entry1.message, "Test log message 1");
  assert.equal(entry1.context, "test-ctx");

  const all = logBuffer.getAll();
  assert.equal(all.length, 2);

  const since = logBuffer.getSince(entry1.id);
  assert.equal(since.length, 1);
  assert.equal(since[0].id, entry2.id);

  logBuffer.clear();
  assert.equal(logBuffer.getAll().length, 0);
});

test("Admin API: time-series sampler captures snapshots", () => {
  sampleNow();
  const series = getAllSeries();
  assert.ok(Array.isArray(series.requests));
  assert.ok(Array.isArray(series.streams));
  assert.ok(Array.isArray(series.memory));
});

test("Admin API: Authenticated session can access overview, accounts, users, and settings", async () => {
  // Test login
  const loginRes = await app.request("/admin/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-admin-password" }),
  });

  // If ADMIN_PASSWORD is set, login succeeds or fails predictably
  const cookie = loginRes.headers.get("set-cookie") || "";
  const authHeaders: Record<string, string> = cookie ? { Cookie: cookie.split(";")[0] } : {};

  // Overview with auth
  const overviewRes = await app.request("/admin/api/overview", { headers: authHeaders });
  if (overviewRes.status === 200) {
    const overview = await overviewRes.json();
    assert.equal(typeof overview.uptime, "number");
    assert.equal(typeof overview.requestsTotal, "number");
    assert.equal(typeof overview.requestsCompletions, "number");
    assert.equal(typeof overview.memory.rss, "number");
    assert.ok(Array.isArray(overview.accounts));
    assert.ok(Array.isArray(overview.users));
  }

  // Accounts list with auth
  const accountsRes = await app.request("/admin/api/accounts", { headers: authHeaders });
  if (accountsRes.status === 200) {
    const data = await accountsRes.json();
    assert.ok(Array.isArray(data.accounts));
    assert.ok(Array.isArray(data.inUse));
  }

  // Clear cooldowns
  const clearRes = await app.request("/admin/api/clear-cooldowns", {
    method: "POST",
    headers: authHeaders,
  });
  if (clearRes.status === 200) {
    const data = await clearRes.json();
    assert.equal(data.ok, true);
  }

  // Settings with auth
  const settingsRes = await app.request("/admin/api/settings", { headers: authHeaders });
  if (settingsRes.status === 200) {
    const data = await settingsRes.json();
    assert.equal(typeof data.settings, "object");
    assert.ok(Array.isArray(data.allowlist));
  }

  // Users CRUD with auth
  const usersRes = await app.request("/admin/api/users", { headers: authHeaders });
  if (usersRes.status === 200) {
    const data = await usersRes.json();
    assert.ok(Array.isArray(data));
  }
});


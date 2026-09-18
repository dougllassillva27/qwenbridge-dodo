import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { config } from "../core/config.js";
import { metrics } from "../core/metrics.js";
import { logHub, type LogItem } from "../core/log-hub.js";
import { loadConfiguredAccounts } from "../core/accounts.js";
import { getAccountCooldownInfo, clearAccountCooldown, clearAllCooldowns } from "../core/account-manager.js";
import { accountTokenUsage } from "../core/metrics.js";
import { getHeapUsageSnapshot, getRssUsageSnapshot } from "../core/memory-usage.js";
import { MemoryCache } from "../cache/memory-cache.js";

export const dashboardApp = new Hono();

const serverStartTime = Date.now();

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function getDashboardData(cacheInstance?: MemoryCache) {
  const heap = getHeapUsageSnapshot();
  const rss = getRssUsageSnapshot();
  const configuredAccounts = loadConfiguredAccounts();

  const accounts = configuredAccounts.map((acc: any) => {
    const cooldown = getAccountCooldownInfo(acc.id);
    const tokens = accountTokenUsage[acc.id] || { prompt: 0, completion: 0, total: 0 };
    return {
      id: acc.id,
      email: acc.email,
      status: cooldown?.onCooldown ? "cooldown" : "active",
      cooldownRemainingMs: cooldown?.remainingMs || 0,
      cooldownReason: cooldown?.reason || null,
      tokens,
    };
  });

  const activeAccounts = accounts.filter((a: any) => a.status === "active").length;
  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);

  return {
    status: "online",
    port: config.server.port,
    uptime: formatUptime(uptimeSec),
    uptimeSeconds: uptimeSec,
    memory: {
      heapUsedMb: Math.round(heap.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(heap.heapTotal / 1024 / 1024),
      rssMb: Math.round(rss.rss / 1024 / 1024),
      maxLimitMb: 4096, // 4GB Docker limit
      percent: Number(((rss.rss / (4096 * 1024 * 1024)) * 100).toFixed(1)),
    },
    metrics: {
      totalRequests: metrics.get("requests.total")?.value || 0,
      totalErrors: metrics.get("requests.errors")?.value || 0,
      cacheFlushed: metrics.get("cache.flushed")?.value || 0,
    },
    accounts: {
      total: accounts.length,
      active: activeAccounts,
      inCooldown: accounts.length - activeAccounts,
      list: accounts,
    },
  };
}

// ─── API Routes ─────────────────────────────────────────────────────────────

dashboardApp.get("/api/dashboard/status", (c) => {
  return c.json(getDashboardData());
});

const faviconPath = path.resolve("assets", "img", "favicon.ico");
let cachedFavicon: Buffer | null = null;
try {
  if (fs.existsSync(faviconPath)) {
    cachedFavicon = fs.readFileSync(faviconPath);
  }
} catch {}

dashboardApp.get("/favicon.ico", (c) => {
  if (cachedFavicon) {
    return c.body(new Uint8Array(cachedFavicon), 200, {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=86400",
    });
  }
  return c.body(null, 204);
});

dashboardApp.get("/assets/img/favicon.ico", (c) => {
  if (cachedFavicon) {
    return c.body(new Uint8Array(cachedFavicon), 200, {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=86400",
    });
  }
  return c.body(null, 204);
});

dashboardApp.get("/.well-known/appspecific/com.chrome.devtools.json", (c) => c.body(null, 204));

dashboardApp.get("/api/logs", (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 150), 300);
  return c.json(logHub.getRecentLogs(limit));
});

dashboardApp.get("/api/logs/stream", (c) => {
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Envia os logs recentes imediatamente ao conectar
      const recent = logHub.getRecentLogs(50);
      for (const item of recent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
      }

      // Listener para novos logs em tempo real
      const onLog = (item: LogItem) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
        } catch {
          isClosed = true;
          logHub.off("log", onLog);
        }
      };

      logHub.on("log", onLog);

      // Heartbeat a cada 15 segundos para manter a conexão viva
      const heartbeat = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          isClosed = true;
          clearInterval(heartbeat);
          logHub.off("log", onLog);
        }
      }, 15000);

      c.req.raw.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(heartbeat);
        logHub.off("log", onLog);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

dashboardApp.post("/api/actions/clear-cooldown", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (body.accountId) {
      clearAccountCooldown(body.accountId);
    } else {
      clearAllCooldowns();
    }
    return c.json({ success: true, message: "Cooldown(s) resetado(s) com sucesso." });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

dashboardApp.post("/api/actions/clear-cache", async (c) => {
  try {
    metrics.increment("cache.flushed");
    return c.json({ success: true, message: "Cache limpo com sucesso." });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// ─── Dashboard HTML Redirect ──────────────────────────────────────────────────

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/admin">
  <title>QwenBridge - PORT 50002</title>
  <script>window.location.replace("/admin");</script>
  <style>
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      background: #090d16;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 24px 32px;
      text-align: center;
      max-width: 440px;
    }
    h1 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 0.875rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; }
    a {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 500;
      border: 1px solid #0284c7;
      padding: 6px 14px;
      border-radius: 6px;
      display: inline-block;
      transition: background 0.15s ease;
    }
    a:hover { background: rgba(56, 189, 248, 0.1); }
  </style>
</head>
<body>
  <div class="card">
    <h1>QwenBridge (PORT 50002)</h1>
    <p>Redirecionando para o painel de administração moderno...</p>
    <a href="/admin">Abrir Web Admin (/admin) &rarr;</a>
  </div>
</body>
</html>`;

dashboardApp.get("/", (c) => {
  return c.html(DASHBOARD_HTML);
});

dashboardApp.get("/dashboard", (c) => {
  return c.html(DASHBOARD_HTML);
});

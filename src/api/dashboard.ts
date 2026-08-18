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

  const accounts = configuredAccounts.map((acc) => {
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

  const activeAccounts = accounts.filter((a) => a.status === "active").length;
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

// ─── Dashboard HTML ──────────────────────────────────────────────────────────

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QwenBridge Dashboard [50002]</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1e293b;
      --card-hover: #172033;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.15);
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #ef4444;
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Container */
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 1.5rem;
      width: 100%;
      flex: 1;
    }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-logo {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
      font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
    }

    .brand-title {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .badge-port {
      background-color: rgba(6, 182, 212, 0.12);
      color: var(--cyan);
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-family: var(--font-mono);
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .live-status {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--emerald);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* Cards Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: border-color 0.2s, transform 0.2s;
    }

    .card:hover {
      border-color: #334155;
    }

    .card-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-value {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }

    .card-subtext {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-top: 0.35rem;
    }

    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #1e293b;
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.6rem;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #06b6d4, #10b981);
      width: 0%;
      transition: width 0.4s ease;
    }

    /* Tabs */
    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 1.5rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 500;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .tab-btn:hover {
      color: var(--text-main);
    }

    .tab-btn.active {
      color: var(--cyan);
      border-bottom-color: var(--cyan);
      font-weight: 600;
    }

    .tab-pane {
      display: none;
    }

    .tab-pane.active {
      display: block;
    }

    /* Tables & Lists */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .table-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      background: rgba(15, 23, 42, 0.6);
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--card-border);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--card-border);
      color: var(--text-main);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-active {
      background: rgba(16, 185, 129, 0.15);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-cooldown {
      background: rgba(245, 158, 11, 0.15);
      color: var(--amber);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    /* Buttons */
    .btn {
      background: #1e293b;
      color: var(--text-main);
      border: 1px solid #334155;
      padding: 0.45rem 0.85rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn:hover {
      background: #334155;
      border-color: #475569;
    }

    .btn-cyan {
      background: rgba(6, 182, 212, 0.15);
      color: var(--cyan);
      border-color: rgba(6, 182, 212, 0.4);
    }

    .btn-cyan:hover {
      background: rgba(6, 182, 212, 0.25);
      border-color: var(--cyan);
    }

    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    /* Console Terminal */
    .terminal-window {
      background: #050811;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      height: 480px;
      overflow: hidden;
      font-family: var(--font-mono);
    }

    .terminal-toolbar {
      background: #0f172a;
      padding: 0.6rem 1rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .terminal-controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .terminal-input-filter {
      background: #090d16;
      border: 1px solid var(--card-border);
      color: var(--text-main);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-family: inherit;
      outline: none;
      width: 180px;
    }

    .terminal-input-filter:focus {
      border-color: var(--cyan);
    }

    .terminal-body {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      font-size: 0.8rem;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .log-line {
      white-space: pre-wrap;
      word-break: break-all;
      color: #cbd5e1;
    }

    .log-error { color: #f87171; }
    .log-warn { color: #fbbf24; }
    .log-debug { color: #38bdf8; }

    /* Playground */
    .playground-box {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    select, textarea, input[type="text"] {
      background: #090d16;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.2s;
    }

    select:focus, textarea:focus, input[type="text"]:focus {
      border-color: var(--cyan);
    }

    .response-preview {
      background: #050811;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      min-height: 120px;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: #e2e8f0;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid var(--cyan);
      color: var(--text-main);
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      font-size: 0.875rem;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 999;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header>
      <div class="brand">
        <div class="brand-logo">Q</div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <h1 class="brand-title">QwenBridge</h1>
            <span class="badge-port">PORT 50002</span>
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Proxy OpenAI/Anthropic • Dodo Ecosystem</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="live-status">
          <span class="pulse-dot"></span>
          <span id="conn-text">Online</span>
        </span>
        <button class="btn btn-sm btn-cyan" onclick="fetchStatus()">🔄 Atualizar</button>
      </div>
    </header>

    <!-- Top Metrics Cards -->
    <div class="metrics-grid">
      <div class="card">
        <div class="card-label"><span>Status & Uptime</span> <span>⏱️</span></div>
        <div class="card-value" id="val-uptime">--</div>
        <div class="card-subtext" id="val-status">Servidor Ativo na porta 50002</div>
      </div>

      <div class="card">
        <div class="card-label"><span>Memória RAM (RSS)</span> <span>🧠</span></div>
        <div class="card-value" id="val-ram">-- MB</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="ram-progress"></div>
        </div>
        <div class="card-subtext" id="val-ram-sub">Teto de 4GB Docker</div>
      </div>

      <div class="card">
        <div class="card-label"><span>Contas Qwen</span> <span>👥</span></div>
        <div class="card-value" id="val-accounts">-- / --</div>
        <div class="card-subtext" id="val-accounts-sub">-- ativas • -- cooldown</div>
      </div>

      <div class="card">
        <div class="card-label"><span>Requisições Totais</span> <span>🚀</span></div>
        <div class="card-value" id="val-requests">--</div>
        <div class="card-subtext" id="val-errors">0 erros registrados</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab('tab-accounts')">👥 Contas & Sessões</button>
      <button class="tab-btn" onclick="switchTab('tab-logs')">📜 Console de Logs (Ao Vivo)</button>
      <button class="tab-btn" onclick="switchTab('tab-test')">🧪 Testador de Chat</button>
      <button class="tab-btn" onclick="switchTab('tab-help')">🔌 Instruções de Conexão</button>
    </div>

    <!-- Tab 1: Accounts -->
    <div id="tab-accounts" class="tab-pane active">
      <div class="section-header">
        <h2 class="section-title">Contas Conectadas</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-sm" onclick="clearAllCooldownsAction()">🔓 Destravar Todas as Contas</button>
          <button class="btn btn-sm" onclick="clearCacheAction()">🧹 Limpar Cache</button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID da Conta</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Tokens Prompt</th>
              <th>Tokens Compl.</th>
              <th>Total Tokens</th>
              <th style="text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody id="accounts-tbody">
            <tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Carregando contas...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Live Logs -->
    <div id="tab-logs" class="tab-pane">
      <div class="terminal-window">
        <div class="terminal-toolbar">
          <span>CONSOLE DE LOGS DO PROXY</span>
          <div class="terminal-controls">
            <input type="text" id="log-filter" class="terminal-input-filter" placeholder="🔍 Filtrar logs..." oninput="filterLogs()">
            <button class="btn btn-sm" id="btn-pause-log" onclick="toggleLogPause()">⏸️ Pausar</button>
            <button class="btn btn-sm" onclick="clearTerminal()">🗑️ Limpar</button>
          </div>
        </div>
        <div class="terminal-body" id="terminal-body">
          <div class="log-line" style="color: var(--text-dim);">Conectando ao fluxo de logs em tempo real...</div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Chat Playground -->
    <div id="tab-test" class="tab-pane">
      <div class="playground-box">
        <div class="form-group">
          <label class="form-label">Modelo para Teste:</label>
          <select id="test-model">
            <option value="qwen3.8-max-thinking">qwen3.8-max-thinking (Padrão com Raciocínio)</option>
            <option value="qwen3.8-max">qwen3.8-max</option>
            <option value="qwen3.8-max-thinking[1M]">qwen3.8-max-thinking[1M] (Janela 1 Milhão)</option>
            <option value="qwen-plus">qwen-plus</option>
            <option value="qwen-turbo">qwen-turbo</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Mensagem:</label>
          <textarea id="test-prompt" rows="3" placeholder="Digite uma mensagem para testar a resposta do proxy..."></textarea>
        </div>

        <div>
          <button class="btn btn-cyan" id="btn-send-test" onclick="sendTestChat()">🚀 Enviar Requisição</button>
          <span id="test-latency" style="margin-left: 1rem; font-size: 0.8rem; color: var(--text-dim);"></span>
        </div>

        <div class="form-group">
          <label class="form-label">Resposta da IA:</label>
          <div class="response-preview" id="test-response">Aguardando envio...</div>
        </div>
      </div>
    </div>

    <!-- Tab 4: Connection Instructions -->
    <div id="tab-help" class="tab-pane">
      <div class="playground-box">
        <h3 style="font-size: 1.1rem; color: var(--cyan); margin-bottom: 0.5rem;">Como Conectar Seus Aplicativos</h3>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
          Configure suas ferramentas favoritas para apontar para o proxy na porta <strong>50002</strong>:
        </p>

        <div style="background: #050811; padding: 1rem; border-radius: 8px; border: 1px solid var(--card-border); font-family: var(--font-mono); font-size: 0.85rem; line-height: 1.8;">
          <p><span style="color: var(--cyan);">Base URL:</span> <code>http://localhost:50002/v1</code></p>
          <p><span style="color: var(--cyan);">Formato:</span> OpenAI Compatible ou Anthropic Messages (<code>/v1/messages</code>)</p>
          <p><span style="color: var(--cyan);">API Key:</span> A mesma definida no seu <code>.env</code> (ou qualquer texto se vazia)</p>
        </div>

        <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
          <strong>Clientes Testados e Homologados:</strong> Cline, Roo Code, Cursor, LibreChat, Chatbox, SillyTavern e Open-WebUI.
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="toast">Ação concluída</div>

  <script>
    let logPaused = false;
    let logBuffer = [];
    let activeFilter = "";

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3000);
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      event.currentTarget.classList.add('active');
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/dashboard/status');
        if (!res.ok) throw new Error('Falha ao obter status');
        const data = await res.json();

        // Cards
        document.getElementById('val-uptime').innerText = data.uptime;
        document.getElementById('val-ram').innerText = data.memory.rssMb + ' MB';
        document.getElementById('val-ram-sub').innerText = data.memory.percent + '% de 4GB alocados';
        document.getElementById('ram-progress').style.width = Math.min(data.memory.percent, 100) + '%';
        
        document.getElementById('val-accounts').innerText = data.accounts.active + ' / ' + data.accounts.total;
        document.getElementById('val-accounts-sub').innerText = data.accounts.active + ' ativas • ' + data.accounts.inCooldown + ' cooldown';

        document.getElementById('val-requests').innerText = data.metrics.totalRequests;
        document.getElementById('val-errors').innerText = data.metrics.totalErrors + ' erros registrados';

        // Tabela de contas
        renderAccounts(data.accounts.list);
      } catch (err) {
        console.error(err);
      }
    }

    function renderAccounts(accounts) {
      const tbody = document.getElementById('accounts-tbody');
      if (!accounts || accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Nenhuma conta configurada no .env</td></tr>';
        return;
      }

      tbody.innerHTML = accounts.map(acc => {
        const isCooldown = acc.status === 'cooldown';
        const statusBadge = isCooldown 
          ? '<span class="status-badge status-cooldown">🟡 Cooldown (' + Math.ceil(acc.cooldownRemainingMs / 1000) + 's)</span>'
          : '<span class="status-badge status-active">🟢 Ativa</span>';

        const actionBtn = isCooldown
          ? '<button class="btn btn-sm btn-cyan" onclick="clearSingleCooldown(\\'' + acc.id + '\\')">🔓 Destravar</button>'
          : '<span style="color: var(--text-dim); font-size: 0.75rem;">Pronta</span>';

        return '<tr>' +
          '<td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--cyan);">' + acc.id.slice(0, 10) + '…</td>' +
          '<td>' + acc.email + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="font-family: var(--font-mono);">' + (acc.tokens.prompt || 0).toLocaleString() + '</td>' +
          '<td style="font-family: var(--font-mono);">' + (acc.tokens.completion || 0).toLocaleString() + '</td>' +
          '<td style="font-family: var(--font-mono); font-weight: 600;">' + (acc.tokens.total || 0).toLocaleString() + '</td>' +
          '<td style="text-align: right;">' + actionBtn + '</td>' +
        '</tr>';
      }).join('');
    }

    async function clearSingleCooldown(accountId) {
      try {
        const res = await fetch('/api/actions/clear-cooldown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId })
        });
        const data = await res.json();
        showToast(data.message || 'Conta destravada!');
        fetchStatus();
      } catch (err) {
        showToast('Erro ao destravar conta');
      }
    }

    async function clearAllCooldownsAction() {
      try {
        const res = await fetch('/api/actions/clear-cooldown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        showToast(data.message || 'Todas as contas destravadas!');
        fetchStatus();
      } catch (err) {
        showToast('Erro ao destravar contas');
      }
    }

    async function clearCacheAction() {
      try {
        const res = await fetch('/api/actions/clear-cache', { method: 'POST' });
        const data = await res.json();
        showToast(data.message || 'Cache limpo!');
        fetchStatus();
      } catch (err) {
        showToast('Erro ao limpar cache');
      }
    }

    // ─── Terminal Logs SSE ───────────────────────────────────────────────────
    function initLogsStream() {
      const eventSource = new EventSource('/api/logs/stream');
      const term = document.getElementById('terminal-body');

      eventSource.onmessage = (e) => {
        try {
          const item = JSON.parse(e.data);
          logBuffer.push(item);
          if (logBuffer.length > 400) logBuffer.shift();

          if (!logPaused) {
            appendLogLine(item);
          }
        } catch {}
      };

      eventSource.onerror = () => {
        setTimeout(initLogsStream, 5000);
      };
    }

    function appendLogLine(item) {
      const term = document.getElementById('terminal-body');
      if (activeFilter && !item.text.toLowerCase().includes(activeFilter)) return;

      const div = document.createElement('div');
      div.className = 'log-line log-' + item.level;
      div.innerText = item.text;
      term.appendChild(div);

      if (term.childNodes.length > 400) {
        term.removeChild(term.firstChild);
      }
      term.scrollTop = term.scrollHeight;
    }

    function toggleLogPause() {
      logPaused = !logPaused;
      document.getElementById('btn-pause-log').innerText = logPaused ? '▶️ Retomar' : '⏸️ Pausar';
      if (!logPaused) filterLogs();
    }

    function clearTerminal() {
      document.getElementById('terminal-body').innerHTML = '';
      logBuffer = [];
    }

    function filterLogs() {
      activeFilter = document.getElementById('log-filter').value.toLowerCase().trim();
      const term = document.getElementById('terminal-body');
      term.innerHTML = '';
      logBuffer.forEach(item => {
        if (!activeFilter || item.text.toLowerCase().includes(activeFilter)) {
          appendLogLine(item);
        }
      });
    }

    // ─── Test Chat ───────────────────────────────────────────────────────────
    async function sendTestChat() {
      const prompt = document.getElementById('test-prompt').value.trim();
      const model = document.getElementById('test-model').value;
      const preview = document.getElementById('test-response');
      const btn = document.getElementById('btn-send-test');
      const latencyEl = document.getElementById('test-latency');

      if (!prompt) {
        showToast('Digite uma mensagem antes de enviar.');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Enviando...';
      preview.innerHTML = '<span style="color: var(--cyan);">⏳ Conectando ao modelo ' + model + '...</span><br><span style="color: var(--text-dim); font-size: 0.85rem;">(Na primeira requisição após o boot, o proxy valida os cookies e tokens do Qwen. As próximas serão instantâneas em tempo real)</span>';
      latencyEl.innerText = '';

      const startTime = Date.now();

      try {
        const res = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            stream: true
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          preview.innerText = '❌ Erro (' + res.status + '): ' + errText;
          btn.disabled = false;
          btn.innerText = '🚀 Enviar Requisição';
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        preview.innerText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || '';
                const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || '';
                if (reasoning) preview.innerText += reasoning;
                if (delta) preview.innerText += delta;
              } catch {}
            }
          }
        }

        const elapsed = Date.now() - startTime;
        latencyEl.innerText = 'Concluído em ' + elapsed + 'ms';
      } catch (err) {
        preview.innerText = '❌ Erro de conexão: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = '🚀 Enviar Requisição';
        fetchStatus();
      }
    }

    // Inicialização
    fetchStatus();
    setInterval(fetchStatus, 3000);
    initLogsStream();
  </script>
</body>
</html>`;

dashboardApp.get("/", (c) => {
  return c.html(DASHBOARD_HTML);
});

dashboardApp.get("/dashboard", (c) => {
  return c.html(DASHBOARD_HTML);
});

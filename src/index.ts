try {
  process.title = "QwenProxy";
} catch {}
process.env.DOTENV_CONFIG_QUIET = 'true'
import dotenv from 'dotenv'
import fs from 'node:fs'
import { getEnvFilePath, ensureDataDirs } from './core/paths.ts'
import { logHub } from './core/log-hub.js'
import { logBuffer } from './core/log-buffer.js'

// Ensure persistent user data directory exists
ensureDataDirs()

// Load .env from local directory or persistent global OS directory
const envPath = getEnvFilePath()
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true })
} else {
  dotenv.config({ quiet: true })
}

// [Dodo] Prefixo universal de timestamp em cada linha de log do proxy
function getTimestamp(): string {
  const t = new Date();
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  return `[${pad2(t.getDate())}/${pad2(t.getMonth() + 1)}/${t.getFullYear()} ${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}]`;
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

function wrapLog(originalFn: (...data: any[]) => void, level: "info" | "warn" | "error" | "debug" = "info") {
  return (...args: any[]) => {
    if (args.length === 0 || (args.length === 1 && typeof args[0] === "string" && args[0].trim() === "")) {
      originalFn(...args);
      return;
    }
    const ts = getTimestamp();
    const formatted = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    logHub.pushLog(`${ts} ${formatted}`, level);
    logBuffer.push(level, formatted);
    originalFn(ts, ...args);
  };
}

console.log = wrapLog(originalLog, "info");
console.warn = wrapLog(originalWarn, "warn");
console.error = wrapLog(originalError, "error");
console.info = wrapLog(originalInfo, "info");

// Prevent benign asynchronous driver/browser teardown exceptions from crashing the server
process.on('uncaughtException', async (error: unknown) => {
  const { isPlaywrightAlreadyClosedError } = await import('./services/playwright.ts');
  if (isPlaywrightAlreadyClosedError(error)) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as any).message)
          : String(error);
    console.warn(`⚠️  [Playwright] Handled benign driver teardown exception: ${msg}`);
    return;
  }
  console.error('❌ [Process] Uncaught Exception:', error);
});

process.on('unhandledRejection', async (reason: unknown) => {
  const { isPlaywrightAlreadyClosedError } = await import('./services/playwright.ts');
  if (isPlaywrightAlreadyClosedError(reason)) {
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'object' && reason !== null && 'message' in reason
          ? String((reason as any).message)
          : String(reason);
    console.warn(`⚠️  [Playwright] Handled benign driver teardown rejection: ${msg}`);
    return;
  }
  console.error('❌ [Process] Unhandled Rejection:', reason);
});
import { startServer } from './api/server.js'
const isTui = process.argv.includes('--tui') || process.env.QWEN_TUI === 'true'

if (isTui) {
  const { TuiApp } = await import('./tui/app.ts')
  const app = new TuiApp()
  await app.start()
} else {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    // Expected configuration errors are already formatted with an emoji and
    // actionable guidance; print only the message to avoid leaking stack traces.
    if (message.includes('No Qwen accounts configured')) {
      console.error(message)
      console.log('\n👉 Dica: Execute a interface interativa com "qpx" (ou "npm run tui") para gerenciar contas,')
      console.log('   ou configure a variável QWEN_ACCOUNTS no seu arquivo .env.\n')
    } else if (message.includes('[Server]')) {
      console.error(message)
    } else {
      console.error('❌ [Server] Failed to start:', message)
    }
    process.exit(1)
  })
}

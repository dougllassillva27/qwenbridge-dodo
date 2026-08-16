import 'dotenv/config'

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

function wrapLog(originalFn: (...data: any[]) => void) {
  return (...args: any[]) => {
    if (args.length === 0 || (args.length === 1 && typeof args[0] === "string" && args[0].trim() === "")) {
      originalFn(...args);
      return;
    }
    originalFn(getTimestamp(), ...args);
  };
}

console.log = wrapLog(originalLog);
console.warn = wrapLog(originalWarn);
console.error = wrapLog(originalError);
console.info = wrapLog(originalInfo);

import { startServer } from './api/server.js'

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  // Expected configuration errors are already formatted with an emoji and
  // actionable guidance; print only the message to avoid leaking stack traces.
  if (message.includes('[Server]')) {
    console.error(message)
  } else {
    console.error('❌ [Server] Failed to start:', message)
  }
  process.exit(1)
})


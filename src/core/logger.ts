import "dotenv/config";

/**
 * Mask an email address for safe logging.
 * "user@example.com" → "user@***"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return "<unknown>";
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "<invalid>";
  return email.substring(0, atIndex);
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * TOOLCALL_DEBUG levels:
 *   "0" or undefined = disabled
 *   "1" = full debug (all toolcall logs)
 *   "errors" = only on errors (log toolcall details when parser/execution fails)
 *
 * UPSTREAM_DEBUG:
 *   "true" = log raw SSE chunks received from Qwen
 */
export type ToolcallDebugLevel = "0" | "1" | "errors";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
}

export function formatDateTimeBR(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `[${day}/${month}/${year} ${hours}:${minutes}:${seconds}]`;
}

export function setupGlobalConsoleTimestamps(): void {
  if ((globalThis as any).__console_timestamps_installed) return;
  (globalThis as any).__console_timestamps_installed = true;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  function wrapArgs(args: any[]): any[] {
    if (args.length === 0) return args;
    const prefix = formatDateTimeBR();
    if (typeof args[0] === "string") {
      // Avoid double-timestamping if line already starts with [DD/MM/YYYY or ISO
      if (
        /^\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]/.test(args[0]) ||
        /^\d{4}-\d{2}-\d{2}T/.test(args[0])
      ) {
        return args;
      }
      return [`${prefix} ${args[0]}`, ...args.slice(1)];
    }
    return [prefix, ...args];
  }

  console.log = (...args: any[]) => originalLog.apply(console, wrapArgs(args));
  console.warn = (...args: any[]) => originalWarn.apply(console, wrapArgs(args));
  console.error = (...args: any[]) => originalError.apply(console, wrapArgs(args));
  console.info = (...args: any[]) => originalInfo.apply(console, wrapArgs(args));
}

// Automatically install global console timestamps on import
setupGlobalConsoleTimestamps();

export class Logger {
  private minLevel: LogLevel;
  private context?: string;

  constructor(level: LogLevel = "info", context?: string) {
    this.minLevel = level;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = formatDateTimeBR(entry.timestamp);
    const pad = (str: string): string => str.padStart(5, " ");
    const colorCode =
      entry.level === "error"
        ? "\x1b[31m"
        : entry.level === "warn"
          ? "\x1b[33m"
          : entry.level === "debug"
            ? "\x1b[36m"
            : "";
    const reset = "\x1b[0m";

    const coloredLevel = colorCode + pad(entry.level.toUpperCase()) + reset;
    const contextPart = entry.context ? ` [${entry.context}]` : "";

    let output = `${timestamp} ${coloredLevel}${contextPart} ${entry.message}`;

    if (entry.data) {
      output += "\n" + JSON.stringify(entry.data, null, 2);
    }

    return output;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.log(
        this.formatEntry({
          timestamp: new Date(),
          level: "debug",
          message: this.context ? `[${this.context}] ${message}` : message,
          data,
        }),
      );
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.log(
        this.formatEntry({
          timestamp: new Date(),
          level: "info",
          message: this.context ? `[${this.context}] ${message}` : message,
          data,
        }),
      );
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(
        this.formatEntry({
          timestamp: new Date(),
          level: "warn",
          message: this.context ? `[${this.context}] ${message}` : message,
          data,
        }),
      );
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(
        this.formatEntry({
          timestamp: new Date(),
          level: "error",
          message: this.context ? `[${this.context}] ${message}` : message,
          data,
        }),
      );
    }
  }
}

// Determine initial log level from environment
const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
const toolcallDebugEnv = process.env.TOOLCALL_DEBUG || "errors";

export const toolcallDebugLevel: ToolcallDebugLevel =
  toolcallDebugEnv === "1"
    ? "1"
    : toolcallDebugEnv === "errors"
      ? "errors"
      : "0";

const initialLevel: LogLevel =
  toolcallDebugLevel === "1"
    ? "debug"
    : envLevel && ["debug", "info", "warn", "error"].includes(envLevel)
      ? envLevel
      : "info";

export const logger = new Logger(initialLevel);

// Helper to check if toolcall debug is enabled
export function isToolcallDebugEnabled(): boolean {
  return toolcallDebugLevel === "1";
}

export function isToolcallErrorDebugEnabled(): boolean {
  return toolcallDebugLevel === "1" || toolcallDebugLevel === "errors";
}

export const upstreamDebugEnabled = process.env.UPSTREAM_DEBUG === "true";

// Confirm debug mode on startup (only log if explicitly set)
if (process.env.TOOLCALL_DEBUG) {
  if (toolcallDebugLevel === "1") {
    console.log("🔍 [Logger] TOOLCALL_DEBUG=1 - full debug logs active");
  } else if (toolcallDebugLevel === "errors") {
    console.log(
      "[Logger] TOOLCALL_DEBUG=errors - toolcall logs on errors only",
    );
  } else {
    console.log("🔇 [Logger] TOOLCALL_DEBUG=0 - toolcall logs disabled");
  }
}

if (upstreamDebugEnabled) {
  console.log(
    "[Logger] UPSTREAM_DEBUG=true - raw upstream chunks logging active",
  );
}

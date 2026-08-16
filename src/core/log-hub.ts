import { EventEmitter } from "node:events";

export interface LogItem {
  id: number;
  text: string;
  level: "info" | "warn" | "error" | "debug";
  timestamp: string;
}

class LogHub extends EventEmitter {
  private buffer: LogItem[] = [];
  private maxBufferSize = 400;
  private seq = 0;

  pushLog(text: string, level: "info" | "warn" | "error" | "debug" = "info"): LogItem {
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const t = new Date();
    const timestamp = `[${pad2(t.getDate())}/${pad2(t.getMonth() + 1)}/${t.getFullYear()} ${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())}]`;

    // Detect level from text if not explicitly provided or if default
    let detectedLevel = level;
    if (text.includes("❌") || text.includes("ERROR") || text.includes("error")) {
      detectedLevel = "error";
    } else if (text.includes("⚠️") || text.includes("WARN") || text.includes("warn")) {
      detectedLevel = "warn";
    } else if (text.includes("🔍") || text.includes("DEBUG") || text.includes("debug")) {
      detectedLevel = "debug";
    }

    const item: LogItem = {
      id: ++this.seq,
      text,
      level: detectedLevel,
      timestamp,
    };

    this.buffer.push(item);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    this.emit("log", item);
    return item;
  }

  getRecentLogs(limit = 100): LogItem[] {
    return this.buffer.slice(-limit);
  }

  clear(): void {
    this.buffer = [];
    this.emit("clear");
  }
}

export const logHub = new LogHub();

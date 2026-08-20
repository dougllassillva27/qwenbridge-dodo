const MAX_SIZE = 500;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
}

export type LogListener = (entry: LogEntry) => void;

class LogBuffer {
  private entries: LogEntry[] = [];
  private nextId = 1;
  private listeners: Set<LogListener> = new Set();

  push(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_SIZE) {
      this.entries.shift();
    }

    for (const listener of this.listeners) {
      listener(entry);
    }

    return entry;
  }

  getAll(): LogEntry[] {
    return this.entries;
  }

  getSince(id: number): LogEntry[] {
    return this.entries.filter((e) => e.id > id);
  }

  clear(): void {
    this.entries = [];
  }

  getListeners(): LogListener[] {
    return Array.from(this.listeners);
  }

  addListener(fn: LogListener): void {
    this.listeners.add(fn);
  }

  removeListener(fn: LogListener): void {
    this.listeners.delete(fn);
  }
}

export const logBuffer = new LogBuffer();

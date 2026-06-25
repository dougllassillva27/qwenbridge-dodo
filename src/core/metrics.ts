import { EventEmitter } from "events";
import { exec } from "child_process";
import util from "util";
import { config } from "./config.js";

const execAsync = util.promisify(exec);

interface MetricPoint {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

type MetricType = "counter" | "gauge" | "histogram" | "summary";

interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  values: Map<string, MetricPoint>;
  histogramBuckets?: number[];
}

export class Metrics extends EventEmitter {
  private metrics: Map<string, MetricDefinition> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaults: Array<[string, MetricType, string]> = [
      // Core request metrics
      ["requests.total", "counter", "Total requests processed"],
      ["requests.errors", "counter", "Total request errors"],
      ["latency.request", "histogram", "Request latency (ms)"],
      
      // Token metrics
      ["tokens.prompt", "counter", "Total prompt tokens"],
      ["tokens.completion", "counter", "Total completion tokens"],
      ["tokens.total", "counter", "Total tokens used"],

      // Stream metrics
      ["streams.active", "gauge", "Active SSE streams"],
      ["streams.errors", "counter", "Stream errors"],

      // Memory metrics
      ["memory.heap.used", "gauge", "Heap memory used (bytes)"],
      ["memory.heap.total", "gauge", "Heap memory total (bytes)"],
      ["memory.tree.used", "gauge", "Total memory used by process tree (bytes)"],

      // Cache metrics
      ["cache.set", "counter", "Cache set operations"],
      ["cache.hit", "counter", "Cache hits"],
      ["cache.miss", "counter", "Cache misses"],
      ["cache.deleted", "counter", "Cache deletions"],
      ["cache.flushed", "counter", "Cache flushes"],
      ["cache.value.size", "histogram", "Cache value size (bytes)"],
      ["cache.get.latency", "histogram", "Cache get latency (ms)"],
      ["cache.hit.ratio", "gauge", "Cache hit ratio (hits / (hits + misses))"],
      [
        "cache.compression.ratio",
        "histogram",
        "Compression ratio (original / compressed)",
      ],
      [
        "cache.compression.bytes.saved",
        "counter",
        "Total bytes saved by compression",
      ],
      [
        "cache.topic.invalidation",
        "counter",
        "Cache entries invalidated by topic change",
      ],
      [
        "cache.memory.usage.bytes",
        "gauge",
        "Estimated cache memory usage (bytes)",
      ],
      ["cache.entries.count", "gauge", "Current number of cache entries"],
      [
        "topic.change.detected",
        "counter",
        "Detected conversation topic changes",
      ],

      // Watchdog metrics
      [
        "watchdog.ram.status",
        "gauge",
        "Watchdog RAM status (0=ok, 1=warning, 2=critical)",
      ],
      [
        "watchdog.overall",
        "gauge",
        "Watchdog overall status (0=healthy, 1=degraded, 2=unhealthy)",
      ],
      ["watchdog.recovery.triggered", "counter", "Recovery attempts triggered"],
      ["watchdog.recovery.success", "counter", "Successful recoveries"],
      ["watchdog.recovery.failed", "counter", "Failed recoveries"],
    ];

    for (const [name, type, help] of defaults) {
      this.metrics.set(name, {
        name,
        type,
        help,
        values: new Map(),
        histogramBuckets:
          type === "histogram"
            ? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
            : undefined,
      });
    }
  }

  increment(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "counter") return;

    const key = labels ? JSON.stringify(labels) : "default";
    const current = metric.values.get(key)?.value || 0;
    metric.values.set(key, {
      value: current + value,
      timestamp: Date.now(),
      labels,
    });
    this.emit("metric", {
      name,
      type: "counter",
      value: current + value,
      labels,
    });
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "gauge") return;

    const key = labels ? JSON.stringify(labels) : "default";
    metric.values.set(key, { value, timestamp: Date.now(), labels });
    this.emit("metric", { name, type: "gauge", value, labels });
  }

  histogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "histogram") return;

    const key = labels ? JSON.stringify(labels) : "default";
    const existing = metric.values.get(key);
    const data = existing?.value || {
      count: 0,
      sum: 0,
      buckets: new Map<number, number>(),
    };

    if (typeof data === "object" && data !== null) {
      data.count++;
      data.sum += value;
      for (const bucket of metric.histogramBuckets || []) {
        data.buckets.set(
          bucket,
          (data.buckets.get(bucket) || 0) + (value <= bucket ? 1 : 0),
        );
      }
    }

    metric.values.set(key, {
      value: data as any,
      timestamp: Date.now(),
      labels,
    });
    this.emit("metric", { name, type: "histogram", value, labels });
  }

  startCollection(): void {
    if (this.collectionInterval) return;

    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics().catch(() => {});
    }, config.metrics.interval);
  }

  private async collectSystemMetrics(): Promise<void> {
    const mem = process.memoryUsage();
    this.gauge("memory.heap.used", mem.heapUsed);
    this.gauge("memory.heap.total", mem.heapTotal);

    try {
      const treeMemory = await getTreeMemoryUsage();
      this.gauge("memory.tree.used", treeMemory);
    } catch (err) {
      this.gauge("memory.tree.used", mem.rss);
    }
  }

  get(name: string, labels?: Record<string, string>): MetricPoint | null {
    const metric = this.metrics.get(name);
    if (!metric) return null;
    const key = labels ? JSON.stringify(labels) : "default";
    return metric.values.get(key) || null;
  }

  formatPrometheus(): string {
    let output = "";
    for (const metric of this.metrics.values()) {
      output += `# HELP ${metric.name} ${metric.help}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;

      for (const [key, point] of metric.values) {
        const labelsStr = point.labels
          ? `{${Object.entries(point.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(",")}}`
          : "";
        output += `${metric.name}${labelsStr} ${point.value} ${point.timestamp}\n`;
      }
    }
    return output;
  }

  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.values.clear();
    }
    this.emit("reset", {});
  }

  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }
}

export const metrics = new Metrics();

async function getTreeMemoryUsage(): Promise<number> {
  const currentPid = process.pid;
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, WorkingSetSize | ConvertTo-Json"'
      );
      if (!stdout || stdout.trim() === "") {
        return process.memoryUsage().rss;
      }

      let processes;
      try {
        processes = JSON.parse(stdout);
      } catch (e) {
        return process.memoryUsage().rss;
      }

      const procList = Array.isArray(processes) ? processes : [processes];

      const adj: Record<number, { pid: number; parent: number; memory: number }[]> = {};
      const selfMap: Record<number, { pid: number; parent: number; memory: number }> = {};

      for (const proc of procList) {
        if (!proc || proc.ProcessId === undefined) continue;
        const pid = proc.ProcessId;
        const parent = proc.ParentProcessId;
        const memory = proc.WorkingSetSize || 0;

        const item = { pid, parent, memory };
        selfMap[pid] = item;
        if (!adj[parent]) adj[parent] = [];
        adj[parent].push(item);
      }

      let totalMemory = 0;
      const queue = [currentPid];
      const visited = new Set<number>();

      while (queue.length > 0) {
        const pid = queue.shift()!;
        if (visited.has(pid)) continue;
        visited.add(pid);

        const selfItem = selfMap[pid];
        if (selfItem) {
          totalMemory += selfItem.memory;
        }

        const children = adj[pid];
        if (children) {
          for (const child of children) {
            queue.push(child.pid);
          }
        }
      }
      return totalMemory;
    } else if (process.platform === 'linux') {
      // Linux: use /proc filesystem to calculate tree memory
      const { stdout } = await execAsync(
        `ps --ppid ${currentPid} -o pid=,rss=`
      );

      if (!stdout || stdout.trim() === "") {
        return process.memoryUsage().rss;
      }

      let totalMemory = process.memoryUsage().rss;
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 2) {
          const rss = parseInt(parts[1], 10);
          if (!isNaN(rss)) {
            totalMemory += rss * 1024; // Convert KB to bytes
          }
        }
      }

      return totalMemory;
    }
  } catch (err) {
    // Fail silently to avoid clogging console logs
  }
  return process.memoryUsage().rss;
}

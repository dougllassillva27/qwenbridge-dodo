/**
 * In-memory time-series sampler for the admin dashboard.
 * Samples throughput, latency, active streams, memory (RSS) and sessions every
 * interval, keeping a rolling window so the UI can render live charts.
 */

import os from 'os'
import { metrics } from './metrics.js'
import { getSessionCount } from '../services/session-manager.js'

interface Sample {
  t: number
  v: number
}

const MAX_POINTS = 240 // 20min @ 5s
const series: Record<string, Sample[]> = {}
const lastValues = new Map<string, number>()

let timer: NodeJS.Timeout | null = null

function push(name: string, v: number): void {
  const arr = (series[name] ||= [])
  arr.push({ t: Date.now(), v })
  if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS)
}

function diff(name: string, value: number): number {
  const prev = lastValues.get(name)
  lastValues.set(name, value)
  return prev === undefined ? 0 : value - prev
}

export function sampleNow(): void {
  const counter = (n: string) => (metrics.get(n)?.value as number) || 0
  const latency = metrics.get('latency.request')?.value as { count: number; sum: number } | null | undefined
  const mem = process.memoryUsage()
  const systemTotal = os.totalmem()

  // Throughput deltas per interval.
  push('requests', diff('requests.total', counter('requests.total')))
  push('completions', diff('completions.total', counter('requests.completions')))
  push('errors', diff('requests.errors', counter('requests.errors')))

  // Average latency within the interval.
  const latCount = latency?.count || 0
  const latSum = latency?.sum || 0
  const countDelta = diff('latency.count', latCount)
  const sumDelta = diff('latency.sum', latSum)
  push('latency', countDelta > 0 ? Math.round(sumDelta / countDelta) : 0)

  // Gauges.
  push('streams', counter('streams.active'))
  push('memory', systemTotal > 0 ? Number(((mem.rss / systemTotal) * 100).toFixed(2)) : 0)
  push('sessions', getSessionCount())
}

export function getSeries(name: string): Sample[] {
  return (series[name] || []).slice()
}

export function getAllSeries(): Record<string, Sample[]> {
  return series
}

export function startTimeSeriesSampling(intervalMs = 5000): void {
  if (timer) return
  sampleNow()
  timer = setInterval(sampleNow, intervalMs)
  timer.unref?.()
}

export function stopTimeSeriesSampling(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  lastValues.clear()
}
type MetricTags = Record<string, string | number | boolean>

type TimingStats = {
  count: number
  totalMs: number
  minMs: number
  maxMs: number
  lastMs: number
}

const timings = new Map<string, TimingStats>()
const counters = new Map<string, number>()

function buildKey(name: string, tags?: MetricTags): string {
  if (!tags) return name
  const tagString = Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join(',')
  return tagString ? `${name}|${tagString}` : name
}

export function recordTiming(name: string, durationMs: number, tags?: MetricTags): void {
  const key = buildKey(name, tags)
  const current = timings.get(key)
  if (!current) {
    timings.set(key, {
      count: 1,
      totalMs: durationMs,
      minMs: durationMs,
      maxMs: durationMs,
      lastMs: durationMs,
    })
    return
  }
  current.count += 1
  current.totalMs += durationMs
  current.minMs = Math.min(current.minMs, durationMs)
  current.maxMs = Math.max(current.maxMs, durationMs)
  current.lastMs = durationMs
}

export function incrementCounter(name: string, delta = 1, tags?: MetricTags): void {
  const key = buildKey(name, tags)
  counters.set(key, (counters.get(key) || 0) + delta)
}

export function getMetricsSnapshot() {
  const timingSnapshot: Record<string, TimingStats & { avgMs: number }> = {}
  for (const [key, stats] of timings.entries()) {
    timingSnapshot[key] = {
      ...stats,
      avgMs: stats.totalMs / Math.max(1, stats.count),
    }
  }

  const counterSnapshot: Record<string, number> = {}
  for (const [key, value] of counters.entries()) {
    counterSnapshot[key] = value
  }

  return {
    timings: timingSnapshot,
    counters: counterSnapshot,
    capturedAt: new Date().toISOString(),
  }
}

export function resetMetrics(): void {
  timings.clear()
  counters.clear()
}

/**
 * 性能指标收集工具
 */

export interface PerformanceMetrics {
  name: string
  timestamp: number
  duration: number
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
  }
  cpu?: {
    user: number
    system: number
  }
}

export interface ResponseTimeMetrics {
  min: number
  max: number
  mean: number
  stddev: number
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
}

export class MetricsCollector {
  private metrics: PerformanceMetrics[] = []
  private startTime: number = 0

  start() {
    this.startTime = Date.now()
    this.metrics = []
  }

  record(name: string, duration?: number): PerformanceMetrics {
    const metric: PerformanceMetrics = {
      name,
      timestamp: Date.now(),
      duration: duration ?? (Date.now() - this.startTime),
      memory: process.memoryUsage(),
    }

    this.metrics.push(metric)
    return metric
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics
  }

  /**
   * 计算响应时间统计
   */
  calculateResponseTimes(durations: number[]): ResponseTimeMetrics {
    if (durations.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        stddev: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      }
    }

    const sorted = durations.sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const mean = sum / sorted.length

    // 计算标准差
    const squaredDiffs = sorted.map(x => Math.pow(x - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length
    const stddev = Math.sqrt(variance)

    // 计算百分位数
    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1
      return sorted[Math.max(0, index)]
    }

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      stddev,
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    }
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 格式化时长
   */
  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`
    } else {
      const minutes = Math.floor(ms / 60000)
      const seconds = ((ms % 60000) / 1000).toFixed(0)
      return `${minutes}m ${seconds}s`
    }
  }

  /**
   * 打印性能报告
   */
  printReport(metrics: ResponseTimeMetrics) {
    console.log('\n📊 性能指标统计:')
    console.log('─'.repeat(60))
    console.log(`  最小值:     ${this.formatDuration(metrics.min)}`)
    console.log(`  最大值:     ${this.formatDuration(metrics.max)}`)
    console.log(`  平均值:     ${this.formatDuration(metrics.mean)}`)
    console.log(`  标准差:     ${this.formatDuration(metrics.stddev)}`)
    console.log('\n  百分位数:')
    console.log(`    P50:      ${this.formatDuration(metrics.p50)}`)
    console.log(`    P75:      ${this.formatDuration(metrics.p75)}`)
    console.log(`    P90:      ${this.formatDuration(metrics.p90)}`)
    console.log(`    P95:      ${this.formatDuration(metrics.p95)}`)
    console.log(`    P99:      ${this.formatDuration(metrics.p99)}`)
    console.log('─'.repeat(60))
  }

  /**
   * 打印内存报告
   */
  printMemoryReport(startMemory: NodeJS.MemoryUsage, endMemory: NodeJS.MemoryUsage) {
    console.log('\n💾 内存使用情况:')
    console.log('─'.repeat(60))

    const formatRow = (label: string, start: number, end: number) => {
      const delta = end - start
      const deltaPercent = ((delta / start) * 100).toFixed(1)
      const deltaStr = delta > 0 ? `+${this.formatBytes(delta)}` : this.formatBytes(delta)
      return `  ${label.padEnd(12)} ${this.formatBytes(start).padStart(10)} → ${this.formatBytes(end).padStart(10)} (${deltaStr}, ${deltaPercent}%)`
    }

    console.log(formatRow('堆使用:', startMemory.heapUsed, endMemory.heapUsed))
    console.log(formatRow('堆总量:', startMemory.heapTotal, endMemory.heapTotal))
    console.log(formatRow('RSS:', startMemory.rss, endMemory.rss))
    console.log(formatRow('外部:', startMemory.external || 0, endMemory.external || 0))
    console.log('─'.repeat(60))
  }
}

export const metrics = new MetricsCollector()

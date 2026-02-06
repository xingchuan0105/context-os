/**
 * 计时器工具 - 用于精确测量每个阶段的耗时
 */
export interface TimerResult {
  name: string
  duration: number
  start: number
  end: number
}

export class Timer {
  private results: Map<string, TimerResult> = new Map()
  private stack: string[] = []

  /**
   * 开始计时
   */
  start(name: string): void {
    this.stack.push(name)
  }

  /**
   * 结束计时并记录结果
   */
  end(name?: string): number {
    const timerName = name || this.stack[this.stack.length - 1]
    if (!timerName) {
      console.warn('⚠️  [Timer] No timer to end')
      return 0
    }

    // 查找开始时间
    const startTimeKey = `__start_${timerName}`
    const startTime = (this as any)[startTimeKey]
    if (!startTime) {
      console.warn(`⚠️  [Timer] No start time found for "${timerName}"`)
      return 0
    }

    const duration = Date.now() - startTime
    const result: TimerResult = {
      name: timerName,
      duration,
      start: startTime,
      end: Date.now(),
    }

    this.results.set(timerName, result)

    // 清理
    delete (this as any)[startTimeKey]
    const idx = this.stack.indexOf(timerName)
    if (idx >= 0) this.stack.splice(idx, 1)

    return duration
  }

  /**
   * 测量异步函数执行时间
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const key = `__start_${name}`
    ;(this as any)[key] = Date.now()
    this.stack.push(name)

    try {
      return await fn()
    } finally {
      this.end(name)
    }
  }

  /**
   * 获取所有结果
   */
  getResults(): TimerResult[] {
    return Array.from(this.results.values()).sort((a, b) => a.start - b.start)
  }

  /**
   * 获取特定结果
   */
  getResult(name: string): TimerResult | undefined {
    return this.results.get(name)
  }

  /**
   * 重置所有计时器
   */
  reset(): void {
    this.results.clear()
    this.stack = []
    // 清理所有开始时间标记
    for (const key of Object.keys(this)) {
      if (key.startsWith('__start_')) {
        delete (this as any)[key]
      }
    }
  }

  /**
   * 格式化耗时显示
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 1000).toFixed(1)}s (${Math.floor(ms / 60000)}m)`
  }

  /**
   * 生成报告
   */
  report(): string {
    const results = this.getResults()
    if (results.length === 0) return 'No timing data available'

    const total = results.reduce((sum, r) => sum + r.duration, 0)
    const lines: string[] = []

    lines.push('\n' + '='.repeat(70))
    lines.push('⏱️  TIMING REPORT')
    lines.push('='.repeat(70))

    for (const result of results) {
      const percent = ((result.duration / total) * 100).toFixed(1)
      const icon = this.getStatusIcon(result.duration)
      lines.push(`  ${icon} ${result.name.padEnd(30)} ${Timer.formatDuration(result.duration).padStart(12)} (${percent}%)`)
    }

    lines.push('-'.repeat(70))
    lines.push(`  TOTAL${' '.repeat(28)}${Timer.formatDuration(total).padStart(12)}`)
    lines.push('='.repeat(70))

    return lines.join('\n')
  }

  /**
   * 根据耗时返回状态图标
   */
  private getStatusIcon(duration: number): string {
    if (duration < 100) return '🟢'
    if (duration < 1000) return '🟢'
    if (duration < 5000) return '🟡'
    if (duration < 15000) return '🟠'
    return '🔴'
  }
}

/**
 * 全局单例计时器
 */
export const timer = new Timer()

/**
 * 控制台报告器 - 格式化输出测试结果
 */

import type { TimerResult } from '../utils/timer'
import type { MetricCheck } from '../utils/metrics'
import { Timer } from '../utils/timer'

export interface TestReport {
  suite: string
  tests: TestResult[]
  totalTime: number
}

export interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'skip'
  duration: number
  error?: string
  metrics?: MetricCheck[]
}

export class ConsoleReporter {
  private indent = 0
  private results: TestResult[] = []

  /**
   * 打印标题
   */
  title(text: string, char = '='): void {
    const line = char.repeat(Math.min(70, text.length + 4))
    console.log(`\n${line}`)
    console.log(`  ${text}`)
    console.log(`${line}`)
  }

  /**
   * 打印章节
   */
  section(text: string): void {
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`  ${text}`)
    console.log('─'.repeat(70))
  }

  /**
   * 打印子章节
   */
  subsection(text: string): void {
    console.log(`\n  📋 ${text}`)
  }

  /**
   * 增加缩进
   */
  indentIn(): void {
    this.indent += 2
  }

  /**
   * 减少缩进
   */
  indentOut(): void {
    this.indent = Math.max(0, this.indent - 2)
  }

  /**
   * 打印带缩进的文本
   */
  print(text: string): void {
    console.log(' '.repeat(this.indent) + text)
  }

  /**
   * 打印成功
   */
  success(text: string): void {
    this.print(`✅ ${text}`)
  }

  /**
   * 打印失败
   */
  error(text: string): void {
    this.print(`❌ ${text}`)
  }

  /**
   * 打印警告
   */
  warning(text: string): void {
    this.print(`⚠️  ${text}`)
  }

  /**
   * 打印信息
   */
  info(text: string): void {
    this.print(`ℹ️  ${text}`)
  }

  /**
   * 打印耗时
   */
  duration(name: string, ms: number): void {
    const icon = this.getDurationIcon(ms)
    const formatted = Timer.formatDuration(ms)
    this.print(`${icon} ${name}: ${formatted}`)
  }

  /**
   * 打印指标检查结果
   */
  metric(check: MetricCheck): void {
    const formatted = this.formatMetric(check)
    this.print(formatted)
  }

  /**
   * 打印测试结果
   */
  testResult(result: TestResult): void {
    this.results.push(result)

    const icon = { pass: '✅', fail: '❌', skip: '⏭️ ' }[result.status]
    const duration = Timer.formatDuration(result.duration)

    if (result.status === 'pass') {
      this.success(`${result.name} (${duration})`)
    } else if (result.status === 'fail') {
      this.error(`${result.name} (${duration})`)
      if (result.error) {
        this.indentIn()
        this.print(`   原因: ${result.error}`)
        this.indentOut()
      }
    } else {
      this.print(`${icon} ${result.name} (跳过)`)
    }
  }

  /**
   * 打印计时报告
   */
  timingReport(results: TimerResult[]): void {
    if (results.length === 0) return

    const total = results.reduce((sum, r) => sum + r.duration, 0)

    console.log('\n' + '═'.repeat(70))
    console.log('  ⏱️  耗时统计')
    console.log('═'.repeat(70))

    for (const result of results) {
      const percent = ((result.duration / total) * 100).toFixed(1)
      const icon = this.getDurationIcon(result.duration)
      const formatted = Timer.formatDuration(result.duration)
      console.log(`  ${icon} ${result.name.padEnd(30)} ${formatted.padStart(10)} (${percent}%)`)
    }

    console.log('─'.repeat(70))
    console.log(`  总计: ${Timer.formatDuration(total).padStart(55)}`)
    console.log('═'.repeat(70))
  }

  /**
   * 打印汇总报告
   */
  summary(results: TestResult[]): void {
    const total = results.length
    const passed = results.filter(r => r.status === 'pass').length
    const failed = results.filter(r => r.status === 'fail').length
    const skipped = results.filter(r => r.status === 'skip').length
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0)
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0'

    console.log('\n' + '╔' + '═'.repeat(68) + '╗')
    console.log('║' + ' '.repeat(15) + '测试汇总报告' + ' '.repeat(45) + '║')
    console.log('╠' + '═'.repeat(68) + '╣')

    console.log(`║  总计${' '.repeat(10)}${String(total).padStart(5)}${' '.repeat(13)}总耗时${' '.repeat(10)}${Timer.formatDuration(totalTime).padStart(10)} ║`)
    console.log(`║  通过${' '.repeat(10)}${String(passed).padStart(5)} ${'✅'.padStart(8)}${' '.repeat(13)}通过率${' '.repeat(10)}${passRate.padStart(5)}%${' '.repeat(7)} ║`)

    if (failed > 0) {
      console.log(`║  失败${' '.repeat(10)}${String(failed).padStart(5)} ${'❌'.padStart(8)}${' '.repeat(32)} ║`)
    }

    if (skipped > 0) {
      console.log(`║  跳过${' '.repeat(10)}${String(skipped).padStart(5)} ${'⏭️ '.padStart(8)}${' '.repeat(32)} ║`)
    }

    console.log('╚' + '═'.repeat(68) + '╝')

    // 打印失败的测试
    if (failed > 0) {
      console.log('\n失败的测试:')
      for (const result of results.filter(r => r.status === 'fail')) {
        this.error(`  - ${result.name}`)
        if (result.error) {
          console.log(`      ${result.error}`)
        }
      }
    }
  }

  /**
   * 获取耗时图标
   */
  private getDurationIcon(ms: number): string {
    if (ms < 100) return '🟢'
    if (ms < 1000) return '🟢'
    if (ms < 5000) return '🟡'
    if (ms < 15000) return '🟠'
    return '🔴'
  }

  /**
   * 格式化指标
   */
  private formatMetric(check: MetricCheck): string {
    const statusIcon = {
      pass: '✅',
      warning: '⚠️ ',
      critical: '🔴',
      fail: '❌',
    }[check.status]

    const actual = Timer.formatDuration(check.actual)
    const target = Timer.formatDuration(check.threshold.target)

    return `${statusIcon} ${check.threshold.name.padEnd(25)} 实际: ${actual.padStart(8)} | 目标: <${target}`
  }

  /**
   * 清空结果
   */
  clear(): void {
    this.results = []
  }

  /**
   * 获取结果
   */
  getResults(): TestResult[] {
    return [...this.results]
  }
}

/**
 * 全局报告器实例
 */
export const reporter = new ConsoleReporter()

/**
 * 并发负载测试
 *
 * 测试目标:
 * - 支持 50 并发用户
 * - 吞吐量 > 100 req/s
 * - 错误率 < 1%
 */

import autocannon from 'autocannon'
import { metrics } from '../utils/metrics'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface TestOptions {
  duration: number
  connections: number
}

interface LoadTestResult {
  name: string
  connections: number
  requests: {
    total: number
    mean: number
    max: number
  }
  latency: {
    mean: number
    min: number
    max: number
  }
  throughput: {
    mean: number
    min: number
  }
  errors: number
  success: boolean
}

/**
 * 运行单个并发级别测试
 */
async function testConcurrencyLevel(
  level: number,
  options: TestOptions
): Promise<LoadTestResult> {
  console.log(`\n🔥 测试并发级别: ${level} 用户`)

  const result = await autocannon({
    url: `${BASE_URL}/api/documents`,
    connections: level,
    duration: options.duration,
    pipelining: 1,
    timeout: 10,
  })

  const testResult: LoadTestResult = {
    name: `并发 ${level} 用户`,
    connections: level,
    requests: {
      total: result.requests.total,
      mean: result.requests.mean,
      max: result.requests.max,
    },
    latency: {
      mean: result.latency.mean,
      min: result.latency.min,
      max: result.latency.max,
    },
    throughput: {
      mean: result.throughput.mean,
      min: result.throughput.min,
    },
    errors: result.errors,
    success: result.errors === 0 && result.throughput.mean > 100,
  }

  console.log(`   吞吐量:     ${testResult.throughput.mean.toFixed(1)} req/s`)
  console.log(`   平均延迟:   ${testResult.latency.mean.toFixed(0)}ms`)
  console.log(`   错误率:     ${testResult.errors}%`)

  return testResult
}

/**
 * 运行所有负载测试
 */
export async function runLoadTests(options: TestOptions): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('⚡ 并发负载测试')
  console.log('='.repeat(60))

  console.log('\n📝 测试配置:')
  console.log(`   目标吞吐量: > 100 req/s`)
  console.log(`   目标错误率: < 1%`)
  console.log(`   测试时长:   ${options.duration}s`)

  const results: LoadTestResult[] = []

  // 渐进式增加并发级别
  const concurrencyLevels = [1, 5, 10, 25, 50, 100]

  for (const level of concurrencyLevels) {
    try {
      const result = await testConcurrencyLevel(level, options)
      results.push(result)
    } catch (error: any) {
      console.error(`\n❌ 并发级别 ${level} 测试失败: ${error.message}`)
    }
  }

  // 生成负载测试报告
  console.log('\n' + '='.repeat(60))
  console.log('📊 负载测试总结报告')
  console.log('='.repeat(60))

  console.log('\n并发级别对比:')
  console.log('─'.repeat(70))
  console.log(
    '  并发数'.padEnd(10) +
    '吞吐量'.padEnd(15) +
    '平均延迟'.padEnd(15) +
    '错误率'.padEnd(10) +
    '状态'
  )
  console.log('─'.repeat(70))

  for (const result of results) {
    const status = result.success ? '✅ 通过' : '❌ 失败'
    console.log(
      result.connections.toString().padEnd(10) +
      `${result.throughput.mean.toFixed(1)} req/s`.padEnd(15) +
      `${result.latency.mean.toFixed(0)}ms`.padEnd(15) +
      `${result.errors}%`.padEnd(10) +
      status
    )
  }
  console.log('─'.repeat(70))

  // 性能分析
  console.log('\n📈 性能分析:')

  const maxThroughput = Math.max(...results.map(r => r.throughput.mean))
  const maxThroughputResult = results.find(r => r.throughput.mean === maxThroughput)

  console.log(`  最大吞吐量: ${maxThroughput.toFixed(1)} req/s (在 ${maxThroughputResult?.connections} 并发时)`)

  // 找出最佳并发级别
  const stableResults = results.filter(r => r.errors === 0 && r.throughput.mean > 100)
  if (stableResults.length > 0) {
    const bestResult = stableResults.reduce((prev, current) =>
      current.throughput.mean > prev.throughput.mean ? current : prev
    )
    console.log(`  推荐并发数: ${bestResult.connections} 用户 (性能最优)`)
  } else {
    console.log(`  ⚠️  警告: 未能达到目标吞吐量 (100 req/s)`)
  }

  // 错误率分析
  const resultsWithErrors = results.filter(r => r.errors > 0)
  if (resultsWithErrors.length > 0) {
    console.log('\n⚠️  错误分析:')
    for (const result of resultsWithErrors) {
      console.log(`   ${result.connections} 并发: ${result.errors}% 错误率`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ 负载测试完成')
  console.log('='.repeat(60))
}

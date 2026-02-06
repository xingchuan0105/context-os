/**
 * 响应时间测试
 *
 * 测试目标:
 * - API 平均响应时间 < 500ms
 * - P95 响应时间 < 1000ms
 * - P99 响应时间 < 2000ms
 */

import autocannon from 'autocannon'
import { metrics } from '../utils/metrics'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface TestOptions {
  duration: number
  connections: number
}

/**
 * 运行单个 API 端点的响应时间测试
 */
async function testEndpoint(
  name: string,
  path: string,
  method: 'GET' | 'POST',
  options: TestOptions
): Promise<void> {
  console.log(`\n🧪 测试: ${name}`)
  console.log(`   端点: ${method} ${path}`)

  const result = await autocannon({
    url: `${BASE_URL}${path}`,
    method,
    connections: options.connections,
    duration: options.duration,
    pipelining: 1,
    timeout: 10,
    // 不生成真实请求，仅测试响应时间
    requests: [
      {
        method,
        path,
      },
    ],
  })

  // 收集指标
  const responseMetrics = metrics.calculateResponseTime(
    result.requests.map((r: any) => r._elapsed)
  )

  metrics.printReport(responseMetrics)

  // 验证性能目标
  console.log('\n✅ 性能目标验证:')
  const checks = [
    { name: '平均响应时间 < 500ms', pass: responseMetrics.mean < 500 },
    { name: 'P95 响应时间 < 1000ms', pass: responseMetrics.p95 < 1000 },
    { name: 'P99 响应时间 < 2000ms', pass: responseMetrics.p99 < 2000 },
  ]

  for (const check of checks) {
    console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`)
  }

  const allPassed = checks.every(c => c.pass)
  if (!allPassed) {
    console.log('\n⚠️  性能目标未达成，可能需要优化')
  }

  // 打印 Autocannon 结果
  console.log(`\n📈 请求统计:`)
  console.log(`  请求数:     ${result.requests.total}`)
  console.log(`  吞吐量:     ${result.requests.mean} req/s`)
  console.log(`  延迟:       ${result.latency.mean}ms (平均)`)
  console.log(`  错误率:     ${result.errors}%`)

  if (result.errors > 0) {
    console.log(`\n❌ 发现 ${result.errors} 个错误`)
    console.log(`   错误详情:`, result.errors)
  }
}

/**
 * 运行所有响应时间测试
 */
export async function runResponseTimeTests(options: TestOptions): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('🎯 响应时间测试')
  console.log('='.repeat(60))

  const tests = [
    {
      name: '文档列表获取',
      path: '/api/documents',
      method: 'GET' as const,
    },
    {
      name: '知识库列表获取',
      path: '/api/knowledge-bases',
      method: 'GET' as const,
    },
    {
      name: '搜索接口 (健康检查)',
      path: '/api/search',
      method: 'POST' as const,
    },
    {
      name: '聊天会话列表',
      path: '/api/chat/sessions',
      method: 'GET' as const,
    },
  ]

  for (const test of tests) {
    try {
      await testEndpoint(test.name, test.path, test.method, options)
    } catch (error: any) {
      console.error(`\n❌ 测试失败: ${test.name}`)
      console.error(`   错误: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ 响应时间测试完成')
  console.log('='.repeat(60))
}

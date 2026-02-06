/**
 * 压力测试
 *
 * 测试目标:
 * - 验证系统在极端负载下的表现
 * - 测试大文档处理能力
 * - 测试高并发场景下的稳定性
 */

import autocannon from 'autocannon'
import { metrics } from '../utils/metrics'
import { processDocumentWithText } from '../../lib/processors/document-processor'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface TestOptions {
  duration: number
  connections: number
}

/**
 * 极限并发压力测试
 */
async function testExtremeConcurrency(options: TestOptions): Promise<void> {
  console.log('\n🔥 极限并发压力测试')
  console.log('─'.repeat(60))

  const concurrencyLevels = [100, 200, 500]

  for (const level of concurrencyLevels) {
    console.log(`\n测试并发级别: ${level}`)

    try {
      const result = await autocannon({
        url: `${BASE_URL}/api/documents`,
        connections: level,
        duration: Math.min(options.duration, 10), // 限制最多10秒
        pipelining: 1,
        timeout: 30,
        amount: level * 10, // 每个连接发送10个请求
      })

      console.log(`   吞吐量:     ${result.throughput.mean.toFixed(1)} req/s`)
      console.log(`   平均延迟:   ${result.latency.mean.toFixed(0)}ms`)
      console.log(`   错误率:     ${result.errors}%`)
      console.log(`   超时率:     ${result.timeouts}%`)

      if (result.errors > 10 || result.timeouts > 10) {
        console.log(`   ⚠️  在 ${level} 并发时系统开始出现不稳定`)
        break
      }

    } catch (error: any) {
      console.log(`   ❌ 失败: ${error.message}`)
      console.log(`   💥 系统在 ${level} 并发时崩溃或无法响应`)
      break
    }
  }
}

/**
 * 大文档处理压力测试
 */
async function testLargeDocuments(): Promise<void> {
  console.log('\n📄 大文档处理压力测试')
  console.log('─'.repeat(60))

  // 生成不同大小的测试文档
  const documentSizes = [
    { name: '小文档', size: 10 * 1024 },        // 10KB
    { name: '中等文档', size: 100 * 1024 },     // 100KB
    { name: '大文档', size: 1024 * 1024 },      // 1MB
    { name: '超大文档', size: 5 * 1024 * 1024 }, // 5MB
  ]

  for (const { name, size } of documentSizes) {
    console.log(`\n处理 ${name} (${metrics.formatBytes(size)}):`)

    // 生成测试文本
    const testText = '测试内容。'.repeat(size / 20) // 每个字符约20字节

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    try {
      await processDocumentWithText({
        userId: 'test-stress-user',
        knowledgeBaseId: 'test-stress-kb',
        fileName: `${name}.txt`,
        fileType: 'text/plain',
        text: testText,
      })

      const duration = Date.now() - startTime
      const endMemory = process.memoryUsage()

      console.log(`   ✅ 成功`)
      console.log(`   耗时: ${metrics.formatDuration(duration)}`)
      console.log(`   内存: ${metrics.formatBytes(endMemory.heapUsed - startMemory.heapUsed)}`)

    } catch (error: any) {
      const duration = Date.now() - startTime
      console.log(`   ❌ 失败: ${error.message}`)
      console.log(`   耗时: ${metrics.formatDuration(duration)}`)
    }
  }
}

/**
 * 长时间运行稳定性测试
 */
async function testLongRunningStability(options: TestOptions): Promise<void> {
  console.log('\n⏱️  长时间运行稳定性测试')
  console.log('─'.repeat(60))

  const duration = Math.min(options.duration, 60) // 最多60秒
  const checkInterval = 10 // 每10秒检查一次
  const checks = Math.ceil(duration / checkInterval)

  console.log(`   测试时长: ${duration}s`)
  console.log(`   检查间隔: ${checkInterval}s`)

  const snapshots: Array<{
    time: number
    memory: NodeJS.MemoryUsage
  }> = []

  const startTime = Date.now()

  for (let i = 0; i < checks; i++) {
    // 执行一些操作
    try {
      await autocannon({
        url: `${BASE_URL}/api/documents`,
        connections: 10,
        duration: checkInterval,
        pipelining: 1,
      })
    } catch (error) {
      // 忽略错误
    }

    // 记录快照
    snapshots.push({
      time: Date.now() - startTime,
      memory: process.memoryUsage(),
    })

    const elapsed = ((i + 1) * checkInterval * 1000) / 1000
    console.log(
      `   进度: ${elapsed.toFixed(0)}s/${duration}s - ` +
      `堆内存: ${metrics.formatBytes(snapshots[i].memory.heapUsed)}`
    )
  }

  // 分析稳定性
  console.log('\n📊 稳定性分析:')
  console.log('─'.repeat(60))

  const startMem = snapshots[0].memory.heapUsed
  const endMem = snapshots[snapshots.length - 1].memory.heapUsed
  const growth = endMem - startMem
  const growthPercent = (growth / startMem) * 100

  console.log(`   初始内存: ${metrics.formatBytes(startMem)}`)
  console.log(`   最终内存: ${metrics.formatBytes(endMem)}`)
  console.log(`   增长:     ${metrics.formatBytes(growth)} (${growthPercent.toFixed(1)}%)`)

  // 计算内存增长率（每分钟）
  const elapsedMinutes = (snapshots[snapshots.length - 1].time / 1000 / 60)
  const growthPerMinute = growth / elapsedMinutes

  console.log(`   增长率:   ${metrics.formatBytes(growthPerMinute)}/分钟`)

  if (growthPercent > 100) {
    console.log(`   ⚠️  警告: 内存增长超过100%，可能存在内存泄漏`)
  } else if (growthPercent > 50) {
    console.log(`   ⚠️  注意: 内存增长较快，建议持续监控`)
  } else {
    console.log(`   ✅ 内存增长正常，系统稳定`)
  }
}

/**
 * 运行所有压力测试
 */
export async function runStressTests(options: TestOptions): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('💥 压力测试')
  console.log('='.repeat(60))

  console.log('\n⚠️  警告: 压力测试会对系统造成较大负载')
  console.log('   建议在非生产环境中运行')

  try {
    await testExtremeConcurrency(options)
  } catch (error: any) {
    console.error('\n❌ 极限并发测试失败:', error.message)
  }

  try {
    await testLargeDocuments()
  } catch (error: any) {
    console.error('\n❌ 大文档测试失败:', error.message)
  }

  try {
    await testLongRunningStability(options)
  } catch (error: any) {
    console.error('\n❌ 长时间运行测试失败:', error.message)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ 压力测试完成')
  console.log('='.repeat(60))

  console.log('\n💡 建议:')
  console.log('   1. 根据压力测试结果调整系统配置')
  console.log('   2. 优化慢查询和高负载操作')
  console.log('   3. 实施请求限流和降级策略')
  console.log('   4. 监控生产系统资源使用情况')
}

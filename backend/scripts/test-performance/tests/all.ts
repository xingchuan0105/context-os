/**
 * 运行所有性能测试
 */

import { runResponseTimeTests } from './response-time.test'
import { runLoadTests } from './load.test'
import { runMemoryLeakTests } from './memory-leak.test'
import { runStressTests } from './stress.test'

interface TestOptions {
  duration: number
  connections: number
}

export async function runAllPerformanceTests(options: TestOptions): Promise<void> {
  const totalStartTime = Date.now()

  console.log('\n' + '═'.repeat(60))
  console.log('🚀 完整性能测试流程')
  console.log('═'.repeat(60))

  console.log('\n📋 测试计划:')
  console.log('   1. 响应时间测试 (API 性能基准)')
  console.log('   2. 并发负载测试 (多用户场景)')
  console.log('   3. 内存泄漏测试 (稳定性验证)')
  console.log('   4. 压力测试 (极限性能)')

  try {
    // 1. 响应时间测试
    console.log('\n' + '═'.repeat(60))
    await runResponseTimeTests(options)

    // 2. 负载测试
    console.log('\n' + '═'.repeat(60))
    await runLoadTests(options)

    // 3. 内存测试
    console.log('\n' + '═'.repeat(60))
    await runMemoryLeakTests(options)

    // 4. 压力测试
    console.log('\n' + '═'.repeat(60))
    await runStressTests(options)

    const totalTime = Date.now() - totalStartTime

    console.log('\n' + '═'.repeat(60))
    console.log('🎉 完整性能测试完成')
    console.log('═'.repeat(60))
    console.log(`\n⏱️  总耗时: ${Math.floor(totalTime / 1000)}s`)

  } catch (error: any) {
    console.error('\n❌ 性能测试失败:', error.message)
    throw error
  }
}

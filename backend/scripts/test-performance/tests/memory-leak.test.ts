/**
 * 内存泄漏检测测试
 *
 * 测试目标:
 * - 24小时运行无崩溃
 * - 内存使用稳定，无持续增长
 * - 堆内存使用 < 2GB
 */

import { metrics } from '../utils/metrics'
import { createLLMClient } from '../../lib/llm-client'
import { upsertPoints, searchPoints } from '../../lib/qdrant'
import { processDocumentWithText } from '../../lib/processors/document-processor'

interface TestOptions {
  duration: number
  connections: number
}

interface MemorySnapshot {
  iteration: number
  timestamp: number
  memory: NodeJS.MemoryUsage
}

/**
 * 运行内存泄漏检测
 */
async function detectMemoryLeak(
  name: string,
  testFn: () => Promise<void>,
  iterations: number = 100
): Promise<void> {
  console.log(`\n🧪 测试: ${name}`)
  console.log(`   迭代次数: ${iterations}`)

  const snapshots: MemorySnapshot[] = []
  const startMemory = process.memoryUsage()

  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc()
    console.log('   已执行初始垃圾回收')
  }

  // 执行多轮测试
  for (let i = 0; i < iterations; i++) {
    await testFn()

    // 每10轮记录一次内存快照
    if (i % 10 === 0) {
      snapshots.push({
        iteration: i,
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      })

      if (global.gc) {
        global.gc()
      }
    }

    // 显示进度
    if (i % 20 === 0) {
      const currentMemory = process.memoryUsage()
      console.log(`   进度: ${i}/${iterations} - 堆内存: ${metrics.formatBytes(currentMemory.heapUsed)}`)
    }
  }

  // 最终内存快照
  if (global.gc) {
    global.gc()
  }
  const endMemory = process.memoryUsage()

  snapshots.push({
    iteration: iterations,
    timestamp: Date.now(),
    memory: endMemory,
  })

  // 分析内存变化趋势
  console.log('\n📊 内存变化趋势:')
  console.log('─'.repeat(60))

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i]
    console.log(
      `   迭代 ${snapshot.iteration.toString().padStart(4)}: ` +
      `堆 ${metrics.formatBytes(snapshot.memory.heapUsed).padStart(10)} ` +
      `RSS ${metrics.formatBytes(snapshot.memory.rss).padStart(10)}`
    )
  }

  metrics.printMemoryReport(startMemory, endMemory)

  // 分析内存泄漏
  const heapGrowth = endMemory.heapUsed - startMemory.heapUsed
  const heapGrowthPercent = (heapGrowth / startMemory.heapUsed) * 100

  console.log('\n🔍 内存泄漏分析:')

  if (heapGrowthPercent > 50) {
    console.log(`   ⚠️  警告: 堆内存增长 ${heapGrowthPercent.toFixed(1)}%`)
    console.log('   可能存在内存泄漏，建议检查代码')
  } else if (heapGrowthPercent > 20) {
    console.log(`   ⚠️  注意: 堆内存增长 ${heapGrowthPercent.toFixed(1)}%`)
    console.log('   内存使用有上升趋势，建议持续监控')
  } else {
    console.log(`   ✅ 正常: 堆内存增长 ${heapGrowthPercent.toFixed(1)}%`)
    console.log('   内存使用稳定，未发现明显泄漏')
  }

  // 检查是否超过阈值
  const MAX_HEAP_SIZE = 2 * 1024 * 1024 * 1024 // 2GB
  if (endMemory.heapUsed > MAX_HEAP_SIZE) {
    console.log(`   ❌ 堆内存超过阈值: ${metrics.formatBytes(endMemory.heapUsed)} > 2GB`)
  } else {
    console.log(`   ✅ 堆内存在阈值内: ${metrics.formatBytes(endMemory.heapUsed)} < 2GB`)
  }
}

/**
 * 测试 LLM 客户端内存泄漏
 */
async function testLLMClientMemory(): Promise<void> {
  const client = createLLMClient('deepseek_chat')

  await detectMemoryLeak(
    'LLM 客户端重复创建',
    async () => {
      const tempClient = createLLMClient('deepseek_chat')
      // 简单调用以触发初始化
      const config = tempClient.getConfig()
      // 不发送实际请求，避免 API 调用
    },
    100
  )
}

/**
 * 测试 Qdrant 操作内存泄漏
 */
async function testQdrantMemory(): Promise<void> {
  const testUserId = 'test-memory-user'
  const testKbId = 'test-memory-kb'

  await detectMemoryLeak(
    'Qdrant 批量插入操作',
    async () => {
      // 创建测试向量点
      const points = Array.from({ length: 10 }, (_, i) => ({
        id: `test-point-${Date.now()}-${i}`,
        vector: Array(768).fill(0).map(() => Math.random()),
        payload: {
          content: `测试内容 ${i}`,
          document_id: `test-doc-${i}`,
          knowledge_base_id: testKbId,
          user_id: testUserId,
          timestamp: Date.now(),
        },
      }))

      try {
        // 实际执行插入（会失败，但可以测试内存）
        await upsertPoints(testUserId, points)
      } catch (error) {
        // 忽略错误，只测试内存
      }
    },
    50 // 减少迭代次数，因为涉及网络操作
  )
}

/**
 * 测试文档处理内存泄漏
 */
async function testDocumentProcessorMemory(): Promise<void> {
  const testText = `
    # 测试文档

    这是一个测试文档，用于检测内存泄漏。
    包含一些中文字符和标点符号。

    ## 章节 1

    第一章的内容。

    ## 章节 2

    第二章的内容。
  `.repeat(100) // 重复100次，创建较大文档

  await detectMemoryLeak(
    '文档处理操作',
    async () => {
      try {
        await processDocumentWithText({
          userId: 'test-memory-user',
          knowledgeBaseId: 'test-memory-kb',
          fileName: 'test.txt',
          fileType: 'text/plain',
          text: testText,
        })
      } catch (error) {
        // 忽略错误，只测试内存
      }
    },
    50
  )
}

/**
 * 运行所有内存泄漏测试
 */
export async function runMemoryLeakTests(options: TestOptions): Promise<void> {
  console.log('\n' + '='.repeat(60))
  console.log('💾 内存泄漏检测测试')
  console.log('='.repeat(60))

  console.log('\n⚙️  配置:')
  console.log(`   堆内存阈值: < 2GB`)
  console.log(`   增长阈值:   < 50%`)
  console.log(`   垃圾回收:   ${global.gc ? '启用' : '禁用'}`)

  if (!global.gc) {
    console.log('\n⚠️  建议: 使用 --expose-gc 标志运行 Node.js 以获得更准确的内存测试')
    console.log('   命令: node --expose-gc ...')
  }

  try {
    await testLLMClientMemory()
  } catch (error: any) {
    console.error('\n❌ LLM 客户端测试失败:', error.message)
  }

  try {
    await testQdrantMemory()
  } catch (error: any) {
    console.error('\n❌ Qdrant 测试失败:', error.message)
  }

  try {
    await testDocumentProcessorMemory()
  } catch (error: any) {
    console.error('\n❌ 文档处理测试失败:', error.message)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ 内存泄漏测试完成')
  console.log('='.repeat(60))

  console.log('\n💡 建议:')
  console.log('   1. 定期运行内存测试以检测新的内存泄漏')
  console.log('   2. 使用 Chrome DevTools 进行更深入的内存分析')
  console.log('   3. 在生产环境中监控内存使用情况')
  console.log('   4. 考虑使用 heapdump 包进行堆快照分析')
}

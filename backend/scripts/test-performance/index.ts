#!/usr/bin/env tsx
/**
 * 性能测试套件主入口
 *
 * 使用方式:
 *   tsx scripts/test-performance/index.ts                    # 运行所有性能测试
 *   tsx scripts/test-performance/index.ts --type=response    # 只运行响应时间测试
 *   tsx scripts/test-performance/index.ts --type=load        # 只运行负载测试
 *   tsx scripts/test-performance/index.ts --type=memory      # 只运行内存测试
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../.env.local')
config({ path: envPath })

// 解析命令行参数
const args = process.argv.slice(2)
const options = {
  type: 'all',  // all, response, load, memory, stress
  duration: 30, // 默认测试时长（秒）
  connections: 10, // 默认并发连接数
}

for (const arg of args) {
  if (arg.startsWith('--type=')) {
    options.type = arg.split('=')[1]
  } else if (arg.startsWith('--duration=')) {
    options.duration = parseInt(arg.split('=')[1])
  } else if (arg.startsWith('--connections=')) {
    options.connections = parseInt(arg.split('=')[1])
  }
}

/**
 * 主测试运行器
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Context OS - 性能测试套件                                 ║
║                                                               ║
║   响应时间 • 并发负载 • 内存泄漏 • 压力测试                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

配置:
  测试类型: ${options.type}
  测试时长: ${options.duration}s
  并发连接: ${options.connections}
`)

  try {
    switch (options.type) {
      case 'response': {
        const { runResponseTimeTests } = await import('./tests/response-time.test')
        await runResponseTimeTests(options)
        break
      }

      case 'load': {
        const { runLoadTests } = await import('./tests/load.test')
        await runLoadTests(options)
        break
      }

      case 'memory': {
        const { runMemoryLeakTests } = await import('./tests/memory-leak.test')
        await runMemoryLeakTests(options)
        break
      }

      case 'stress': {
        const { runStressTests } = await import('./tests/stress.test')
        await runStressTests(options)
        break
      }

      case 'all':
      default: {
        const { runAllPerformanceTests } = await import('./tests/all')
        await runAllPerformanceTests(options)
        break
      }
    }

    console.log('\n✅ 性能测试完成\n')
    process.exit(0)

  } catch (error: any) {
    console.error('\n❌ 性能测试失败:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行
main()

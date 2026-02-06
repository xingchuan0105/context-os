#!/usr/bin/env tsx
/**
 * 测试套件主入口
 *
 * 使用方式:
 *   tsx scripts/test-suite/index.ts                    # 运行所有测试
 *   tsx scripts/test-suite/index.ts --suite=infra     # 只运行基础设施测试
 *   tsx scripts/test-suite/index.ts --suite=units     # 只运行单元测试
 *   tsx scripts/test-suite/index.ts --suite=integration --level=1  # 集成测试 Level 1
 *   MOCK_LEVEL=fast tsx scripts/test-suite/index.ts --suite=integration  # 使用 Mock 模式
 */

// 加载环境变量
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../.env.local')
config({ path: envPath })

// 加载基础工具（始终需要）
import { timer } from './utils/timer'
import { reporter } from './reporters/console'

// 解析命令行参数
const args = process.argv.slice(2)
const options = {
  suite: 'all',      // all, infra, units, integration
  level: undefined as number | undefined,  // 集成测试级别
  mockKType: true,   // 默认使用 Mock 模式
}

for (const arg of args) {
  if (arg.startsWith('--suite=')) {
    options.suite = arg.split('=')[1]
  } else if (arg.startsWith('--level=')) {
    options.level = parseInt(arg.split('=')[1])
  } else if (arg === '--no-mock') {
    options.mockKType = false
  }
}

// 检查 MOCK_LEVEL 环境变量
if (process.env.MOCK_LEVEL === 'FAST' || process.env.MOCK_LEVEL === 'fast') {
  options.mockKType = true
} else if (process.env.MOCK_LEVEL === 'NONE' || process.env.MOCK_LEVEL === 'none') {
  options.mockKType = false
}

/**
 * 主测试运行器
 */
async function main() {
  const totalStartTime = Date.now()
  timer.reset()

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🧪 Context OS - 测试套件                                     ║
║                                                               ║
║   结构化 ��� 渐进式 • 快速反馈                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

配置:
  Suite: ${options.suite}
  Integration Level: ${options.level ?? 'all'}
  Mock K-Type: ${options.mockKType ? '✅' : '❌'}
`)

  const results: boolean[] = []

  try {
    // 动态导入测试模块，避免加载不需要的模块
    switch (options.suite) {
      case 'infra': {
        const { runInfrastructureTests } = await import('./suites/infra.test')
        results.push(await runInfrastructureTests())
        break
      }

      case 'units': {
        const { runAllUnitTests } = await import('./suites/units/index')
        results.push(await runAllUnitTests({ mockKType: options.mockKType }))
        break
      }

      case 'integration': {
        const { runIntegrationTests } = await import('./suites/integration/index')
        results.push(await runIntegrationTests(options.level, { mockKType: options.mockKType }))
        break
      }

      case 'all':
      default: {
        // 完整测试流程: Infra -> Units -> Integration
        reporter.title('开始完整测试流程')
        console.log('  将按以下顺序执行:')
        console.log('    1. 基础设施检查 (L1)')
        console.log('    2. 单元测试 (L2)')
        console.log('    3. 集成测试 (L3)')
        console.log()

        // L1: 基础设施
        const { runInfrastructureTests } = await import('./suites/infra.test')
        const infraPassed = await runInfrastructureTests()
        results.push(infraPassed)

        if (!infraPassed) {
          console.log('\n⚠️  基础设施检查失败，跳过后续测试')
          process.exit(1)
        }

        // L2: 单元测试
        const { runAllUnitTests } = await import('./suites/units/index')
        const unitsPassed = await runAllUnitTests({ mockKType: options.mockKType })
        results.push(unitsPassed)

        // L3: 集成测试 (渐进式)
        if (unitsPassed) {
          const { runIntegrationTests } = await import('./suites/integration/index')
          const integrationPassed = await runIntegrationTests(undefined, {
            mockKType: options.mockKType,
          })
          results.push(integrationPassed)
        }

        break
      }
    }

    const totalTime = Date.now() - totalStartTime

    // 打印计时报告
    reporter.timingReport(timer.getResults())

    // 最终汇总
    const allPassed = results.every(r => r)

    console.log('\n' + '╔' + '═'.repeat(68) + '╗')
    console.log('║' + ' '.repeat(20) + '最终测试结果' + ' '.repeat(31) + '║')
    console.log('╠' + '═'.repeat(68) + '╣')

    if (allPassed) {
      console.log('║' + ' '.repeat(23) + '✅ 全部通过' + ' '.repeat(33) + '║')
      console.log('╚' + '═'.repeat(68) + '╝')
      console.log(`\n总耗时: ${(totalTime / 1000).toFixed(1)}s\n`)
      process.exit(0)
    } else {
      console.log('║' + ' '.repeat(23) + '❌ 存在失败' + ' '.repeat(33) + '║')
      console.log('╚' + '═'.repeat(68) + '╝')
      console.log(`\n总耗时: ${(totalTime / 1000).toFixed(1)}s\n`)
      process.exit(1)
    }

  } catch (error: any) {
    console.error('\n❌ 测试运行出错:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行
main()

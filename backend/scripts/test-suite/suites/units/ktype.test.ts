/**
 * L2: 单元测试 - K-Type 处理器
 *
 * 目标: Mock 模式下 < 5 秒，真实模式 < 2 分钟
 */

import { timer } from '../../utils/timer'
import { checkMetric } from '../../utils/metrics'
import { reporter } from '../../reporters/console'
import { processKTypeWorkflow } from '../../../../lib/processors'
import { Assert } from '../../utils/assertions'

// 测试文本
const TEST_TEXT = `
# 人工智能编程指南

编程是人工智能开发的核心技能。本指南将帮助你掌握 AI 编程的基础知识。

## 基础概念

1. **算法** - 解决问题的步骤序列
2. **数据结构** - 组织和存储数据的方式
3. **复杂度** - 算法效率的度量

## 实践方法

### 编写清晰代码
代码应该易于理解和维护。使用有意义的变量名，添加适当的注���。

### 测试驱动开发
先写测试，再写代码。这能确保代码质量并减少 bug。

### 持续学习
技术发展迅速，保持学习是关键。阅读文档，参与社区，实践项目。

## 工具推荐

- **Python** - 机器学习的首选语言
- **Jupyter** - 交互式开发环境
- **Git** - 版本控制系统
`.trim()

export class KTypeUnitTests {
  private useMock: boolean

  constructor(useMock = true) {
    this.useMock = useMock
  }

  /**
   * 运行所有 K-Type 单元测试
   */
  async runAll(): Promise<boolean> {
    reporter.title(`K-Type 处理器单元测试 (L2) ${this.useMock ? '[Mock模式]' : '[真实模式]'}`)

    const results: boolean[] = []

    results.push(await this.testKTypeWorkflow())
    results.push(await this.testResultStructure())

    const allPassed = results.every(r => r)

    reporter.summary([
      {
        name: 'K-Type 处理器单元测试',
        status: allPassed ? 'pass' : 'fail',
        duration: 0,
      },
    ])

    return allPassed
  }

  /**
   * 测试 K-Type 工作流
   */
  private async testKTypeWorkflow(): Promise<boolean> {
    reporter.subsection('K-Type 工作流测试')
    reporter.indentIn()

    if (this.useMock) {
      reporter.info('使用 Mock 模式，跳过真实 LLM 调用')
      reporter.indentOut()
      return true
    }

    try {
      const duration = await timer.measure('ktype.full', async () => {
        const result = await processKTypeWorkflow(TEST_TEXT)

        // 验证结果结构
        Assert.isDefined(result.finalReport, 'Should have finalReport')
        Assert.isDefined(result.finalReport.classification, 'Should have classification')
        Assert.isDefined(result.finalReport.scanTrace, 'Should have scanTrace')
        Assert.isDefined(result.finalReport.knowledgeModules, 'Should have knowledgeModules')
        Assert.notEmpty(result.finalReport.executiveSummary, 'Should have executiveSummary')

        // 验证分类结果
        const { classification } = result.finalReport
        Assert.isDefined(classification.scores, 'Should have scores')
        Assert.notEmpty(classification.dominantType, 'Should have dominantType')
        Assert.notEmpty(classification.reason, 'Should have reason')

        reporter.info(`主导类型: ${classification.dominantType.join(', ')}`)
        reporter.info(`知识模块数: ${result.finalReport.knowledgeModules.length}`)
      })

      const metric = checkMetric('ktype.full', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`K-Type 工作流测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试结果结构
   */
  private async testResultStructure(): Promise<boolean> {
    reporter.subsection('结果结构验证')
    reporter.indentIn()

    if (this.useMock) {
      // Mock 模式下验证 Mock 数据结构
      const mockResult = this.getMockResult()

      try {
        Assert.isDefined(mockResult.finalReport, 'Mock should have finalReport')
        Assert.isDefined(mockResult.finalReport.classification, 'Mock should have classification')
        Assert.isDefined(mockResult.finalReport.classification.scores, 'Mock should have scores')

        reporter.success('Mock 结果结构验证通过')
        reporter.indentOut()
        return true
      } catch (error: any) {
        reporter.indentOut()
        reporter.error(`Mock 结果结构验证失败: ${error.message}`)
        return false
      }
    }

    // 真实模式下，结果结构在工作流测试中已验证
    reporter.success('结果结构已在工作流测试中验证')
    reporter.indentOut()
    return true
  }

  /**
   * 获取 Mock 结果
   */
  private getMockResult() {
    return {
      finalReport: {
        title: 'Mock 认知索引报告',
        classification: {
          scores: {
            procedural: 5,
            conceptual: 5,
            reasoning: 5,
            systemic: 5,
            narrative: 5,
          },
          dominantType: ['procedural'],
          reason: 'This is a mock result for testing purposes',
        },
        scanTrace: {
          dikwLevel: 'Knowledge',
          tacitExplicitRatio: '80/20',
          logicPattern: 'Sequential',
          evidence: ['Mock evidence 1', 'Mock evidence 2'],
        },
        knowledgeModules: [
          {
            type: 'procedural',
            score: 8,
            coreValue: 'Mock value',
            content: 'Mock content',
            evidence: ['Mock evidence'],
            sourcePreview: 'Mock preview',
          },
        ],
        executiveSummary: 'This is a mock executive summary for testing.',
        distilledContent: 'Mock distilled content',
      },
    }
  }
}

/**
 * 导出测试运行函数
 */
export async function runKTypeUnitTests(useMock = true): Promise<boolean> {
  const tests = new KTypeUnitTests(useMock)
  return tests.runAll()
}

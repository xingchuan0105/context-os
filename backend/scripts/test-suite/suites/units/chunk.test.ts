/**
 * L2: 单元测试 - 分块器
 *
 * 目标: 每个分块测试 < 5 秒
 */

import { timer } from '../../utils/timer'
import { checkMetric } from '../../utils/metrics'
import { reporter } from '../../reporters/console'
import { splitIntoParentChildChunksBatch } from '../../../../lib/chunkers'
import { Assert } from '../../utils/assertions'

// 测试数据
const SHORT_TEXT = 'This is a short text for testing chunking.'

const MEDIUM_TEXT = `
# 人工智能简介

人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

## 主要分支

### 机器学习
机器学习是人工智能的一个分支，它使计算机能够从数据中学习，而不需要显式编程。这是 AI 领域最重要的技术之一。

### 深度学习
深度学习是机器学习的子集，使用多层神经网络模拟人脑的学习过程。它在图像识别、自然语言处理等领域取得了突破性进展。

### 自然语言处理
自然语言处理（NLP）是人工智能的重要应用领域，致力于让计算机理解和生成人类语言。这包括机器翻译、情感分析、文本摘要等任务。

## 应用领域

1. **计算机视觉** - 图像识别、目标检测
2. **语音识别** - 语音转文字、语音助手
3. **推荐系统** - 个性化推荐
4. **自动驾驶** - 智能交通
5. **医疗诊断** - 辅助诊断、药物研发

## 未来展望

随着技术的不断进步，人工智能将在更多领域发挥重要作用，同时也带来伦理和就业等方面的挑战。
`.trim()

const LONG_TEXT = MEDIUM_TEXT.repeat(10) // 约 2000 字

export class ChunkUnitTests {
  /**
   * 运行所有分块器单元测试
   */
  async runAll(): Promise<boolean> {
    reporter.title('分块器单元测试 (L2)')

    const results: boolean[] = []

    results.push(await this.testSmallChunk())
    results.push(await this.testMediumChunk())
    results.push(await this.testLargeChunk())
    results.push(await this.testChunkStructure())

    const allPassed = results.every(r => r)

    reporter.summary([
      {
        name: '分块器单元测试',
        status: allPassed ? 'pass' : 'fail',
        duration: 0,
      },
    ])

    return allPassed
  }

  /**
   * 测试小文本分块
   */
  private async testSmallChunk(): Promise<boolean> {
    reporter.subsection('小文本分块测试 (<100 tokens)')
    reporter.indentIn()

    try {
      const duration = await timer.measure('chunk.small', async () => {
        const result = await splitIntoParentChildChunksBatch(SHORT_TEXT, {
          parentChunkSize: 1024,
          childChunkSize: 256,
          removeExtraSpaces: true,
          removeUrlsEmails: true,
        })

        Assert.notEmpty(result.parentChunks, 'Should have at least one parent chunk')
        Assert.notEmpty(result.childChunks, 'Should have at least one child chunk')
      })

      const metric = checkMetric('chunk.small', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`小文本分块测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试中等文本分块
   */
  private async testMediumChunk(): Promise<boolean> {
    reporter.subsection('中等文本分块测试 (~1000 tokens)')
    reporter.indentIn()

    try {
      const duration = await timer.measure('chunk.medium', async () => {
        const result = await splitIntoParentChildChunksBatch(MEDIUM_TEXT, {
          parentChunkSize: 1024,
          childChunkSize: 256,
          removeExtraSpaces: true,
          removeUrlsEmails: true,
        })

        Assert.greaterThan(result.parentChunks.length, 0, 'Should have parent chunks')
        Assert.greaterThan(result.childChunks.length, 0, 'Should have child chunks')

        // 验证父子关系
        const parentIndices = new Set(result.parentChunks.map(p => p.index))
        for (const child of result.childChunks) {
          Assert.isTrue(
            parentIndices.has(child.parentIndex),
            `Child's parentIndex ${child.parentIndex} should exist in parent chunks`
          )
        }

        reporter.info(`父块数: ${result.parentChunks.length}, 子块数: ${result.childChunks.length}`)
      })

      const metric = checkMetric('chunk.medium', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`中等文本分块测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试大文本分块
   */
  private async testLargeChunk(): Promise<boolean> {
    reporter.subsection('大文本分块测试 (~10000 tokens)')
    reporter.indentIn()

    try {
      const duration = await timer.measure('chunk.large', async () => {
        const result = await splitIntoParentChildChunksBatch(LONG_TEXT, {
          parentChunkSize: 1024,
          childChunkSize: 256,
          removeExtraSpaces: true,
          removeUrlsEmails: true,
        })

        Assert.greaterThan(result.parentChunks.length, 5, 'Should have multiple parent chunks')
        Assert.greaterThan(result.childChunks.length, 10, 'Should have multiple child chunks')

        reporter.info(`父块数: ${result.parentChunks.length}, 子块数: ${result.childChunks.length}`)
      })

      const metric = checkMetric('chunk.large', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`大文本分块测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试分块结构
   */
  private async testChunkStructure(): Promise<boolean> {
    reporter.subsection('分块结构验证测试')
    reporter.indentIn()

    try {
      const result = await splitIntoParentChildChunksBatch(MEDIUM_TEXT, {
        parentChunkSize: 1024,
        childChunkSize: 256,
        removeExtraSpaces: true,
        removeUrlsEmails: true,
      })

      // 验证父块结构
      for (const parent of result.parentChunks) {
        Assert.notEmpty(parent.content, 'Parent content should not be empty')
        Assert.isDefined(parent.index, 'Parent should have index')
      }

      // 验证子块结构
      for (const child of result.childChunks) {
        Assert.notEmpty(child.content, 'Child content should not be empty')
        Assert.isDefined(child.index, 'Child should have index')
        Assert.isDefined(child.parentIndex, 'Child should have parentIndex')
      }

      // 验证子块内容不大于父块（理论上）
      for (const parent of result.parentChunks) {
        const children = result.childChunks.filter(c => c.parentIndex === parent.index)
        for (const child of children) {
          Assert.lessThan(
            child.content.length,
            parent.content.length * 1.5, // 允许一定冗余
            'Child content should not be much larger than parent'
          )
        }
      }

      reporter.success('分块结构验证通过')
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`分块结构验证失败: ${error.message}`)
      return false
    }
  }
}

/**
 * 导出测试运行函数
 */
export async function runChunkUnitTests(): Promise<boolean> {
  const tests = new ChunkUnitTests()
  return tests.runAll()
}

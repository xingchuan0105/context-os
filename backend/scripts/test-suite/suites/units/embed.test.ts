/**
 * L2: 单元测试 - Embedding 处理器
 *
 * 目标: 单个 embedding < 3 秒，批量 (50) < 30 秒
 */

import { timer } from '../../utils/timer'
import { checkMetric } from '../../utils/metrics'
import { reporter } from '../../reporters/console'
import OpenAI from 'openai'
import { Assert } from '../../utils/assertions'

export class EmbeddingUnitTests {
  private client: OpenAI | null = null
  private model: string

  constructor() {
    const apiKey = process.env.EMBEDDING_API_KEY
    const baseURL = process.env.EMBEDDING_BASE_URL

    if (apiKey && baseURL) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
      })
      this.model = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
    }
  }

  /**
   * 运行所有 Embedding 单元测试
   */
  async runAll(): Promise<boolean> {
    reporter.title('Embedding 处理器单元测试 (L2)')

    if (!this.client) {
      reporter.warning('Embedding API 配置缺失，跳过测试')
      return true
    }

    const results: boolean[] = []

    results.push(await this.testSingleEmbedding())
    results.push(await this.testBatchEmbedding())
    results.push(await this.testEmbeddingStructure())

    const allPassed = results.every(r => r)

    reporter.summary([
      {
        name: 'Embedding 处理器单元测试',
        status: allPassed ? 'pass' : 'fail',
        duration: 0,
      },
    ])

    return allPassed
  }

  /**
   * 测试单个 Embedding
   */
  private async testSingleEmbedding(): Promise<boolean> {
    reporter.subsection('单个 Embedding 测试')
    reporter.indentIn()

    try {
      const duration = await timer.measure('embedding.single', async () => {
        const response = await this.client!.embeddings.create({
          model: this.model,
          input: 'This is a test sentence for embedding.',
        })

        Assert.notEmpty(response.data, 'Should have embedding data')
        Assert.equal(response.data.length, 1, 'Should have exactly one embedding')

        const embedding = response.data[0].embedding
        Assert.isTrue(Array.isArray(embedding), 'Embedding should be an array')
        Assert.greaterThan(embedding.length, 0, 'Embedding should not be empty')

        reporter.info(`Embedding 维度: ${embedding.length}`)
      })

      const metric = checkMetric('embedding.single', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`单个 Embedding 测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试批量 Embedding
   */
  private async testBatchEmbedding(): Promise<boolean> {
    reporter.subsection('批量 Embedding 测试 (batch 10)')
    reporter.indentIn()

    try {
      const inputs = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.',
        'Fourth test sentence.',
        'Fifth test sentence.',
        'Sixth test sentence.',
        'Seventh test sentence.',
        'Eighth test sentence.',
        'Ninth test sentence.',
        'Tenth test sentence.',
      ]

      const duration = await timer.measure('embedding.batch10', async () => {
        const response = await this.client!.embeddings.create({
          model: this.model,
          input: inputs,
        })

        Assert.equal(response.data.length, inputs.length, `Should have ${inputs.length} embeddings`)

        // 验证所有 embedding 维度一致
        const firstDim = response.data[0].embedding.length
        for (let i = 0; i < response.data.length; i++) {
          Assert.equal(
            response.data[i].embedding.length,
            firstDim,
            `Embedding ${i} dimension mismatch`
          )
        }

        reporter.info(`生成了 ${response.data.length} 个 embedding，维度: ${firstDim}`)
      })

      // 使用 batch10 的阈值
      const metric = checkMetric('embedding.batch10', duration)
      reporter.metric(metric)
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`批量 Embedding 测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 测试 Embedding 结构
   */
  private async testEmbeddingStructure(): Promise<boolean> {
    reporter.subsection('Embedding 结构验证')
    reporter.indentIn()

    try {
      const response = await this.client!.embeddings.create({
        model: this.model,
        input: 'Test structure validation.',
      })

      const embedding = response.data[0].embedding

      // 验证是数字数组
      for (let i = 0; i < embedding.length; i++) {
        Assert.isTrue(
          typeof embedding[i] === 'number',
          `Embedding[${i}] should be a number`
        )
        Assert.isTrue(
          !isNaN(embedding[i]) && isFinite(embedding[i]),
          `Embedding[${i}] should be a valid number`
        )
      }

      // 验证值在合理范围内（通常 -2 到 2 之间）
      const maxVal = Math.max(...embedding)
      const minVal = Math.min(...embedding)
      reporter.info(`Embedding 值范围: [${minVal.toFixed(4)}, ${maxVal.toFixed(4)}]`)

      Assert.isTrue(maxVal <= 10, 'Embedding values should be reasonable')
      Assert.isTrue(minVal >= -10, 'Embedding values should be reasonable')

      reporter.success('Embedding 结构验证通过')
      reporter.indentOut()
      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`Embedding 结构验证失败: ${error.message}`)
      return false
    }
  }
}

/**
 * 导出测试运行函数
 */
export async function runEmbeddingUnitTests(): Promise<boolean> {
  const tests = new EmbeddingUnitTests()
  return tests.runAll()
}

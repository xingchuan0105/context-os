/**
 * L3: 渐进式集成测试
 *
 * 目标: 分层执行，逐级验证
 * - Level 1: 解析 + 分块 (<5秒)
 * - Level 2: 分块 + K-Type (Mock: <5s, Real: ~1分钟)
 * - Level 3: K-Type + Embedding (Mock: <5s, Real: ~2分钟)
 */

import { timer } from '../../utils/timer'
import { checkMetric } from '../../utils/metrics'
import { reporter } from '../../reporters/console'
import { parseFile } from '../../../../lib/parsers'
import { splitIntoParentChildChunksBatch } from '../../../../lib/chunkers'
import { processKTypeWorkflow, processKTypeWorkflowWithFallback } from '../../../../lib/processors'
import OpenAI from 'openai'
import { Assert } from '../../utils/assertions'

const TEST_TEXT = `
# 人工智能完整指南

## 第一章：人工智能概述

人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。这些任务包括学习、推理、问题解决、感知和语言理解。

### 1.1 AI 的历史

人工智能的概念可以追溯到古希腊神话中的机械人，但作为一个学科，AI 始于 1956 年的达特茅斯会议。

### 1.2 AI 的类型

人工智能可以分为三类：
- **弱人工智能（Narrow AI）**: 专注于执行特定任务的系统
- **强人工智能（General AI）**: 具有与人类相当智能水平的系统
- **超人工智能（Super AI）**: 超越人类智能的系统

## 第二章：机器学习基础

机器学习是 AI 的核心子领域，使计算机能够从数据中学习并改进性能。

### 2.1 监督学习

监督学习使用标记数据训练模型，常见算法包括线性回归、决策树、支持向量机和神经网络。

### 2.2 无监督学习

无监督学习从未标记数据中发现模式，包括聚类分析和主成分分析。

### 2.3 强化学习

强化学习通过与环境交互来学习最优策略，应用于游戏 AI 和机器人控制。

## 第三章：深度学习革命

深度学习是机器学习的子集，使用多层神经网络处理复杂问题。

### 3.1 神经网络架构

- **卷积神经网络（CNN）**: 用于图像识别和计算机视觉
- **循环神经网络（RNN）**: 适用于序列数据和时间序列分析
- **Transformer**: 彻底改变自然语言处理的革命性架构

## 第四章：AI 应用领域

1. **医疗健康**: 疾病诊断、药物研发、个性化治疗
2. **金融服务**: 欺诈检测、算法交易、信用评估
3. **交通运输**: 自动驾驶、交通优化、物流规划
4. **教育**: 个性化学习、智能辅导、自动评估

## 第五章：未来展望

人工智能将继续快速发展，但也面临技术挑战和伦理问题。我们需要在推动技术创新的同时，关注 AI 安全、隐私保护和公平性。
`.trim()

export class IntegrationTests {
  private embeddingClient: OpenAI | null = null
  private embeddingModel: string

  constructor() {
    const apiKey = process.env.EMBEDDING_API_KEY
    const baseURL = process.env.EMBEDDING_BASE_URL

    if (apiKey && baseURL) {
      this.embeddingClient = new OpenAI({ apiKey, baseURL })
      this.embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3'
    }
  }

  /**
   * 运行指定级别的集成测试
   */
  async runLevel(level: number, options?: { mockKType?: boolean }): Promise<boolean> {
    switch (level) {
      case 1:
        return this.runLevel1()
      case 2:
        return this.runLevel2(options?.mockKType !== false)
      case 3:
        return this.runLevel3(options?.mockKType !== false)
      case 4:
        return this.runFull(options?.mockKType !== false)
      default:
        reporter.error(`无效的测试级别: ${level}`)
        return false
    }
  }

  /**
   * Level 1: 解析 + 分块
   * 目标: < 5 秒
   */
  async runLevel1(): Promise<boolean> {
    reporter.title('集成测试 Level 1: 解析 + 分块')
    reporter.indentIn()

    try {
      // 步骤 1: 解析
      reporter.subsection('步骤 1: 解析文本')
      const parseResult = await timer.measure('parse.txt', async () => {
        return parseFile(Buffer.from(TEST_TEXT), 'text/plain', 'test.txt')
      })
      reporter.duration('解析耗时', parseResult)
      reporter.info(`文本长度: ${parseResult.content.length} 字符`)

      // 步骤 2: 分块
      reporter.subsection('步骤 2: 父子分块')
      const chunkResult = await timer.measure('chunk.medium', async () => {
        return splitIntoParentChildChunksBatch(parseResult.content, {
          parentChunkSize: 1024,
          childChunkSize: 256,
          removeExtraSpaces: true,
          removeUrlsEmails: true,
        })
      })
      reporter.duration('分块耗时', chunkResult)
      reporter.info(`父块数: ${chunkResult.parentChunks.length}, 子块数: ${chunkResult.childChunks.length}`)

      // 验证
      Assert.notEmpty(chunkResult.parentChunks, '应该有父块')
      Assert.notEmpty(chunkResult.childChunks, '应该有子块')

      reporter.indentOut()
      reporter.summary([
        {
          name: 'Level 1 集成测试',
          status: 'pass',
          duration: parseResult + chunkResult,
        },
      ])

      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`Level 1 测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * Level 2: 分块 + K-Type
   * 目标: Mock < 5s, Real ~ 1分钟
   */
  async runLevel2(useMock = true): Promise<boolean> {
    reporter.title(`集成测试 Level 2: 分块 + K-Type ${useMock ? '[Mock]' : '[Real]'}`)
    reporter.indentIn()

    try {
      // 先执行 Level 1 的内容
      const parseResult = await parseFile(Buffer.from(TEST_TEXT), 'text/plain', 'test.txt')
      const chunkResult = await splitIntoParentChildChunksBatch(parseResult.content, {
        parentChunkSize: 1024,
        childChunkSize: 256,
        removeExtraSpaces: true,
        removeUrlsEmails: true,
      })

      reporter.info(`父块数: ${chunkResult.parentChunks.length}, 子块数: ${chunkResult.childChunks.length}`)

      // 步骤 3: K-Type 处理
      reporter.subsection('步骤 3: K-Type 认知处理')

      if (useMock) {
        reporter.info('使用 Mock 模式')
        const mockResult = this.getMockKTypeResult()
        reporter.duration('K-Type 耗时 (Mock)', 0)
        reporter.info(`主导类型: ${mockResult.finalReport.classification.dominantType.join(', ')}`)
      } else {
        // 根据环境变量选择快速模式或完整模式
        const useFastMode = process.env.K_TYPE_FAST_MODE === 'true'
        reporter.info(`使用 ${useFastMode ? '快速' : '完整'}模式`)

        const metricKey = useFastMode ? 'ktype.fast' : 'ktype.full'
        const ktypeDuration = await timer.measure(metricKey, async () => {
          return useFastMode
            ? await processKTypeWorkflowWithFallback(parseResult.content)
            : await processKTypeWorkflow(parseResult.content)
        })
        reporter.duration('K-Type 耗时', ktypeDuration)

        const metric = checkMetric(metricKey, ktypeDuration)
        reporter.metric(metric)
      }

      reporter.indentOut()
      reporter.summary([
        {
          name: 'Level 2 集成测试',
          status: 'pass',
          duration: 0,
        },
      ])

      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`Level 2 测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * Level 3: K-Type + Embedding
   * 目标: Mock < 5s, Real ~ 2分钟
   */
  async runLevel3(useMock = true): Promise<boolean> {
    reporter.title(`集成测试 Level 3: K-Type + Embedding ${useMock ? '[Mock]' : '[Real]'}`)
    reporter.indentIn()

    if (!this.embeddingClient) {
      reporter.warning('Embedding API 配置缺失，跳过测试')
      return true
    }

    try {
      // 准备数据
      const parseResult = await parseFile(Buffer.from(TEST_TEXT), 'text/plain', 'test.txt')
      const chunkResult = await splitIntoParentChildChunksBatch(parseResult.content, {
        parentChunkSize: 1024,
        childChunkSize: 256,
        removeExtraSpaces: true,
        removeUrlsEmails: true,
      })

      reporter.info(`子块数: ${chunkResult.childChunks.length}`)

      // 步骤 4: 生成 Embedding
      reporter.subsection('步骤 4: 生成向量嵌入')

      // 取前 5 个子块测试
      const testChunks = chunkResult.childChunks.slice(0, 5)
      reporter.info(`测试前 ${testChunks.length} 个子块...`)

      const embedDuration = await timer.measure('embedding.batch10', async () => {
        const response = await this.embeddingClient!.embeddings.create({
          model: this.embeddingModel,
          input: testChunks.map(c => c.content),
        })

        Assert.equal(response.data.length, testChunks.length, 'Embedding 数量不匹配')

        const dimension = response.data[0].embedding.length
        reporter.info(`Embedding 维度: ${dimension}`)
        reporter.info(`向量前5个值: [${response.data[0].embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)

        return response
      })

      reporter.duration('Embedding 耗时', embedDuration)

      const metric = checkMetric('embedding.batch10', embedDuration)
      reporter.metric(metric)

      reporter.indentOut()
      reporter.summary([
        {
          name: 'Level 3 集成测试',
          status: 'pass',
          duration: 0,
        },
      ])

      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`Level 3 测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 完整集成测试 (不含数据库)
   * 目标: Mock < 5s, Real ~ 3分钟
   */
  async runFull(useMock = true): Promise<boolean> {
    reporter.title(`完整集成测试 ${useMock ? '[Mock]' : '[Real]'}`)
    reporter.indentIn()

    const startTime = Date.now()

    try {
      // 完整流程
      reporter.section('步骤 1: 解析文本')
      const parseResult = await parseFile(Buffer.from(TEST_TEXT), 'text/plain', 'test.txt')
      reporter.info(`文本长度: ${parseResult.content.length} 字符`)

      reporter.section('步骤 2: 父子分块')
      const chunkResult = await splitIntoParentChildChunksBatch(parseResult.content, {
        parentChunkSize: 1024,
        childChunkSize: 256,
        removeExtraSpaces: true,
        removeUrlsEmails: true,
      })
      reporter.info(`父块数: ${chunkResult.parentChunks.length}, 子块数: ${chunkResult.childChunks.length}`)

      reporter.section('步骤 3: K-Type 认知处理')
      if (useMock) {
        reporter.info('使用 Mock 模式')
      } else {
        const useFastMode = process.env.K_TYPE_FAST_MODE === 'true'
        reporter.info(`使用 ${useFastMode ? '快速' : '完整'}模式`)

        const ktypeResult = useFastMode
          ? await processKTypeWorkflowWithFallback(parseResult.content)
          : await processKTypeWorkflow(parseResult.content)
        reporter.info(`主导类型: ${ktypeResult.finalReport.classification.dominantType.join(', ')}`)
      }

      if (this.embeddingClient) {
        reporter.section('步骤 4: 生成向量嵌入')
        const testChunks = chunkResult.childChunks.slice(0, 5)
        const response = await this.embeddingClient.embeddings.create({
          model: this.embeddingModel,
          input: testChunks.map(c => c.content),
        })
        reporter.info(`生成了 ${response.data.length} 个 embedding，维度: ${response.data[0].embedding.length}`)
      } else {
        reporter.warning('Embedding API 未配置，跳过')
      }

      const totalTime = Date.now() - startTime

      reporter.indentOut()
      reporter.summary([
        {
          name: '完整集成测试',
          status: 'pass',
          duration: totalTime,
        },
      ])

      return true
    } catch (error: any) {
      reporter.indentOut()
      reporter.error(`完整集成测试失败: ${error.message}`)
      return false
    }
  }

  /**
   * 获取 Mock K-Type 结果
   */
  private getMockKTypeResult() {
    return {
      finalReport: {
        title: 'Mock 认知索引报告',
        classification: {
          scores: {
            procedural: 7,
            conceptual: 6,
            reasoning: 5,
            systemic: 4,
            narrative: 3,
          },
          dominantType: ['procedural'],
          reason: '这是一份关于人工智能的指南文档，包含大量操作性和概念性内容',
        },
        scanTrace: {
          dikwLevel: 'Knowledge',
          tacitExplicitRatio: '70/30',
          logicPattern: 'Hierarchical',
          evidence: ['包含结构化章节', '有明确定义和概念', '包含实践指导'],
        },
        knowledgeModules: [
          {
            type: 'procedural',
            score: 8,
            coreValue: 'AI 开发和应用的实践指导',
            content: '机器学习算法、深度学习架构的具体实现方法',
            evidence: ['监督学习步骤', '神经网络架构选择'],
            sourcePreview: '监督学习使用标记数据训练模型...',
          },
        ],
        executiveSummary: '本文档是一份全面的人工智能指南，涵盖了 AI 的基础概念、历史发展、核心技术和应用领域。文档重点介绍了机器学习、深度学习等关键技术，并分析了 AI 在医疗、金融、交通、教育等领域的应用前景。',
        distilledContent: '# AI 核心要点\n\n- **定义**: 计算机科学分支，模拟人类智能\n- **关键技术**: 机器学习、深度学习、NLP\n- **应用**: 医疗、金融、交通、教育\n- **未来**: 持续发展，需关注伦理和安全',
      },
    }
  }
}

/**
 * 导出测试运行函数
 */
export async function runIntegrationTests(
  level?: number,
  options?: { mockKType?: boolean }
): Promise<boolean> {
  const tests = new IntegrationTests()

  if (level !== undefined) {
    return tests.runLevel(level, options)
  }

  // 运行所有级别
  reporter.title('渐进式集成测试套件 (L3)')

  const results: boolean[] = []
  results.push(await tests.runLevel1())

  // Level 2 和 3 默认使用 Mock
  results.push(await tests.runLevel2(true))
  results.push(await tests.runLevel3(true))

  return results.every(r => r)
}

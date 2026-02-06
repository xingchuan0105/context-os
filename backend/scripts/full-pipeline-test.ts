#!/usr/bin/env tsx
/**
 * 完整集成测试 - 跑通整个流水线
 * 解析 → 分块 → K-Type → Embedding
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { parseFile } from '../lib/parsers'
import { splitIntoParentChildChunksBatch } from '../lib/chunkers'
import { processKTypeWorkflowWithFallback } from '../lib/processors'
import embeddingClient from '../lib/embedding'

const TEST_TEXT = `
# 人工智能在医疗领域的应用与挑战

## 核心应用

### 医学影像分析
深度学习模型在医学影像分析中表现出色：
- 肺癌筛查：CT影像中的结节检测，灵敏度可达95%以上
- 糖尿病视网膜病变：通过眼底照片识别微血管异常
- 皮肤癌诊断：识别良性与恶性病变

### 药物研发
生成式AI模型可以：
- 生成符合药代动力学性质的分子结构
- 预测分子与靶点的结合亲和力
- 优化先导化合物

### 精准医疗
- 基因组变异解读
- 多基因风险评分
- 个性化治疗方案

## 技术挑战

1. **数据质量**：数据孤���、标准化不足、标注成本高
2. **模型可解释性**：黑盒模型难以获得医生信任
3. **泛化能力**：跨机构、跨种族的适应性

## 伦理问题

- 数据隐私保护（GDPR、HIPAA）
- 算法公平性
- 责任认定

## 未来展望

多模态融合、因果推断、人机协同、持续学习。
`.trim()

interface TestResult {
  stage: string
  duration: number
  success: boolean
  details?: any
  error?: string
}

const results: TestResult[] = []

async function runTest<T>(
  stage: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const start = Date.now()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔄 [${stage}]`)
  console.log('='.repeat(60))

  try {
    const result = await fn()
    const duration = Date.now() - start
    results.push({ stage, duration, success: true })
    console.log(`✅ 完成 (${duration}ms)`)
    return result
  } catch (error: any) {
    const duration = Date.now() - start
    results.push({ stage, duration, success: false, error: error.message })
    console.error(`❌ 失败: ${error.message}`)
    return null
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                   完整流水线集成测试                               ║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log('║   解析 → 分块 → K-Type分析 → Embedding                           ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // 1. 解析
  const parseResult = await runTest('解析文本', async () => {
    return parseFile(Buffer.from(TEST_TEXT), 'text/plain', 'test.txt')
  })
  if (!parseResult) {
    console.error('解析失败，终止测试')
    return
  }
  console.log(`   文本长度: ${parseResult.content.length} 字符`)

  // 2. 分块
  const chunkResult = await runTest('父子分块', async () => {
    return splitIntoParentChildChunksBatch(parseResult.content, {
      parentChunkSize: 1024,
      childChunkSize: 256,
      removeExtraSpaces: true,
      removeUrlsEmails: true,
    })
  })
  if (!chunkResult) {
    console.error('分块失败，终止测试')
    return
  }
  console.log(`   父块数: ${chunkResult.parentChunks.length}`)
  console.log(`   子块数: ${chunkResult.childChunks.length}`)

  // 3. K-Type 分析
  const kTypeResult = await runTest('K-Type 认知分析 (SiliconFlow Pro)', async () => {
    return processKTypeWorkflowWithFallback(parseResult.content)
  })
  if (!kTypeResult) {
    console.error('K-Type 分析失败，终止测试')
    return
  }
  const classification = kTypeResult.finalReport.classification
  console.log(`   主导类型: ${classification.dominantType.join(', ')}`)
  console.log(`   评分: P=${classification.scores.procedural} C=${classification.scores.conceptual} R=${classification.scores.reasoning} S=${classification.scores.systemic} N=${classification.scores.narrative}`)
  console.log(`   知识模块: ${kTypeResult.finalReport.knowledgeModules.length} 个`)
  console.log(`   执行摘要: ${kTypeResult.finalReport.executiveSummary.slice(0, 50)}...`)

  // 4. Embedding
  const embedResult = await runTest('生成向量嵌入', async () => {
    const batchSize = 5
    const batch = chunkResult.childChunks.slice(0, batchSize)
    const response = await embeddingClient.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'BAAI/bge-m3',
      input: batch.map(c => c.content),
    })
    return {
      count: response.data.length,
      dimension: response.data[0].embedding.length,
      sample: response.data[0].embedding.slice(0, 5),
    }
  })
  if (!embedResult) {
    console.error('Embedding 失败')
    return
  }
  console.log(`   生成数量: ${embedResult.count}`)
  console.log(`   向量维度: ${embedResult.dimension}`)
  console.log(`   样本: [${embedResult.sample.map(v => v.toFixed(4)).join(', ')}]`)

  // 汇总
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                          测试结果                                 ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r).length

  console.log('\n📊 耗时统计:')
  results.forEach((r) => {
    const icon = r.success ? '✅' : '❌'
    console.log(`  ${icon} ${r.stage.padEnd(30)} ${(r.duration / 1000).toFixed(2)}s`)
  })
  console.log(`  ─────────────────────────────────────`)
  console.log(`  总计: ${(totalDuration / 1000).toFixed(2)}s`)

  console.log(`\n结果: ${successCount} 成功, ${failCount} 失败`)

  // 性能评估
  console.log('\n📈 性能评估:')
  const kTypeDuration = results.find(r => r.stage.includes('K-Type'))?.duration || 0
  if (kTypeDuration < 20000) {
    console.log(`  🟢 K-Type 速度优秀 (${(kTypeDuration / 1000).toFixed(1)}s < 20s)`)
  } else if (kTypeDuration < 60000) {
    console.log(`  🟡 K-Type 速度良好 (${(kTypeDuration / 1000).toFixed(1)}s < 60s)`)
  } else {
    console.log(`  🔴 K-Type 速度较慢 (${(kTypeDuration / 1000).toFixed(1)}s)`)
  }

  const embedDuration = results.find(r => r.stage.includes('Embedding'))?.duration || 0
  if (embedDuration < 1000) {
    console.log(`  🟢 Embedding 速度优秀 (${(embedDuration / 1000).toFixed(2)}s < 1s)`)
  } else {
    console.log(`  🟡 Embedding 速度正常 (${(embedDuration / 1000).toFixed(2)}s)`)
  }

  if (failCount === 0) {
    console.log('\n🎉 所有测试通过！流水线运行正常。')
  } else {
    console.log('\n⚠️ 部分测试失败，请检查。')
    process.exit(1)
  }
}

main()

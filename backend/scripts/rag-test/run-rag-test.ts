/**
 * RAG 召回自动化测试脚本
 *
 * 运行方式：
 *   npx tsx scripts/rag-test/run-rag-test.ts
 *
 * 环境变量：
 *   TEST_USER_ID - 测试用户ID
 *   TEST_KB_ID - 测试知识库ID
 *   TEST_OUTPUT_FORMAT - 输出格式 (text|markdown|json)
 */

import { ragRetrieve } from '../../lib/rag/retrieval'
import type { SearchResult } from '../../lib/qdrant'
import { TEST_CASES, TEST_CONFIG } from './test-cases'

// ==================== 类型定义 ====================

export interface TestResult {
  caseId: string
  query: string
  category: string
  difficulty: string
  success: boolean
  results: {
    document: SearchResult | null
    parents: SearchResult[]
    children: SearchResult[]
  }
  metrics: {
    totalResults: number
    documentFound: boolean
    parentCount: number
    childCount: number
    avgScore: number
    maxScore: number
  }
  evaluation: {
    relevanceScore: number
    keywordMatch: boolean
    layerMatch: boolean
    expectedMinMet: boolean
    issues: string[]
  }
  latency: number
  timestamp: string
}

export interface TestReport {
  summary: {
    totalCases: number
    passedCases: number
    failedCases: number
    passRate: number
    overallScore: number
    avgLatency: number
    p95Latency: number
  }
  byCategory: Record<string, {
    total: number
    passed: number
    passRate: number
    avgScore: number
  }>
  byDifficulty: Record<string, {
    total: number
    passed: number
    passRate: number
    avgScore: number
  }>
  details: TestResult[]
  recommendations: string[]
}

// ==================== 评估函数 ====================

function evaluateTestCase(
  testCase: any,
  context: any,
  latency: number
): TestResult['evaluation'] {
  const issues: string[] = []
  let relevanceScore = 0
  const expected = testCase.expected

  const totalResults = (context.document ? 1 : 0) + context.parents.length + context.children.length
  const expectedMinMet = totalResults >= (expected?.minResults || 1)

  if (!expectedMinMet) {
    issues.push('召回结果不足：期望至少 ' + (expected?.minResults || 1) + ' 个，实际 ' + totalResults + ' 个')
  }

  const allContent = [
    context.document?.payload.content || '',
    ...context.parents.map((p: any) => p.payload.content),
    ...context.children.map((c: any) => c.payload.content),
  ].join(' ')

  const keywords = expected?.expectedKeywords || []
  let keywordMatchCount = 0
  for (const kw of keywords) {
    if (allContent.toLowerCase().includes(kw.toLowerCase())) {
      keywordMatchCount++
    }
  }
  const keywordMatch = keywords.length === 0 || keywordMatchCount >= keywords.length * 0.5

  if (keywords.length > 0 && keywordMatchCount < keywords.length * 0.5) {
    issues.push('关键词匹配不足：期望 ' + keywords.join(', '))
  }

  const foundLayers: string[] = []
  if (context.document) foundLayers.push('document')
  if (context.parents.length > 0) foundLayers.push('parent')
  if (context.children.length > 0) foundLayers.push('child')

  const expectedLayers = expected?.relevantLayers || []
  const layerMatch = expectedLayers.length === 0 ||
    expectedLayers.some((layer: string) => foundLayers.includes(layer))

  if (!layerMatch && expectedLayers.length > 0) {
    issues.push('层级不匹配：期望 ' + expectedLayers.join(', '))
  }

  relevanceScore = 0
  if (expectedMinMet) relevanceScore += 0.3
  relevanceScore += (keywordMatch ? 0.4 : 0)
  if (layerMatch) relevanceScore += 0.3

  return {
    relevanceScore,
    keywordMatch,
    layerMatch,
    expectedMinMet,
    issues,
  }
}

function calculateAverageScore(results: TestResult[]): number {
  if (results.length === 0) return 0
  const totalScore = results.reduce((sum, r) => sum + r.evaluation.relevanceScore, 0)
  return totalScore / results.length
}

function calculateP95Latency(latencies: number[]): number {
  if (latencies.length === 0) return 0
  const sorted = [...latencies].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * 0.95)
  return sorted[index] || sorted[sorted.length - 1]
}

function generateRecommendations(report: TestReport): string[] {
  const recommendations: string[] = []

  if (report.summary.overallScore < TEST_CONFIG.thresholds.fair) {
    recommendations.push('整体评分较低，建议检查向量嵌入质量和检索参数')
  }

  if (report.byCategory.factual && report.byCategory.factual.avgScore < 0.7) {
    recommendations.push('事实性查询召回不足，建议检查子块的相关度阈值')
  }

  if (report.byCategory.conceptual && report.byCategory.conceptual.avgScore < 0.7) {
    recommendations.push('概念性查询召回不足，建议增强文档层(KTYPE摘要)的质量')
  }

  if (report.byCategory.procedural && report.byCategory.procedural.avgScore < 0.7) {
    recommendations.push('程序性查询召回不足，建议检查父块的章节划分')
  }

  if (report.byCategory.complex && report.byCategory.complex.avgScore < 0.7) {
    recommendations.push('综合性查询召回不足，建议增加文档间的关联')
  }

  if (report.byCategory.boundary && report.byCategory.boundary.passRate < 0.8) {
    recommendations.push('边界情况处理不佳，建议优化无关查询的过滤')
  }

  if (report.summary.p95Latency > 3000) {
    recommendations.push('P95延迟超过3秒，建议优化向量检索性能或增加缓存')
  }

  if (recommendations.length === 0) {
    recommendations.push('系统表现良好，继续保持当前配置')
  }

  return recommendations
}

// ==================== 主测试函数 ====================

async function runSingleTestCase(
  testCase: any,
  userId: string,
  kbId?: string
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const result = await ragRetrieve(userId, testCase.query, {
      kbId,
      scoreThreshold: TEST_CONFIG.defaultParams.scoreThreshold,
      documentLimit: TEST_CONFIG.defaultParams.documentLimit,
      parentLimit: TEST_CONFIG.defaultParams.parentLimit,
      childLimit: TEST_CONFIG.defaultParams.childLimit,
    })

    const latency = Date.now() - startTime

    const allScores = [
      ...(result.context.document ? [result.context.document.score] : []),
      ...result.context.parents.map((p: any) => p.score),
      ...result.context.children.map((c: any) => c.score),
    ]

    const avgScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0

    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0

    return {
      caseId: testCase.id,
      query: testCase.query,
      category: testCase.category,
      difficulty: testCase.difficulty,
      success: false, // will be set after evaluation
      results: {
        document: result.context.document,
        parents: result.context.parents,
        children: result.context.children,
      },
      metrics: {
        totalResults: result.totalResults,
        documentFound: !!result.context.document,
        parentCount: result.context.parents.length,
        childCount: result.context.children.length,
        avgScore,
        maxScore,
      },
      evaluation: evaluateTestCase(testCase, result.context, latency),
      latency,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    const latency = Date.now() - startTime

    return {
      caseId: testCase.id,
      query: testCase.query,
      category: testCase.category,
      difficulty: testCase.difficulty,
      success: false,
      results: {
        document: null,
        parents: [],
        children: [],
      },
      metrics: {
        totalResults: 0,
        documentFound: false,
        parentCount: 0,
        childCount: 0,
        avgScore: 0,
        maxScore: 0,
      },
      evaluation: {
        relevanceScore: 0,
        keywordMatch: false,
        layerMatch: false,
        expectedMinMet: false,
        issues: [error instanceof Error ? error.message : 'Unknown error'],
      },
      latency,
      timestamp: new Date().toISOString(),
    }
  }
}

export async function runAllTests(options: {
  userId: string
  kbId?: string
  categories?: string[]
  filter?: (testCase: any) => boolean
}): Promise<TestReport> {
  const { userId, kbId, categories, filter } = options

  let testCases = [...TEST_CASES]

  if (categories && categories.length > 0) {
    testCases = testCases.filter(tc => categories.includes(tc.category))
  }

  if (filter) {
    testCases = testCases.filter(filter)
  }

  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║          RAG 召回自动化测试 v1.0                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('🧪 开始运行 ' + testCases.length + ' 个测试用例...')
  console.log('   用户ID: ' + userId)
  console.log('   知识库ID: ' + (kbId || '未指定（使用默认）'))
  console.log('   分类: ' + (categories?.join(', ') || '全部'))
  console.log('')

  const results: TestResult[] = []
  const latencies: number[] = []

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    const result = await runSingleTestCase(testCase, userId, kbId)

    // Set success based on evaluation
    result.success = result.evaluation.relevanceScore >= TEST_CONFIG.thresholds.fair

    results.push(result)
    latencies.push(result.latency)

    const status = result.success ? '✓' : '✗'
    const score = (result.evaluation.relevanceScore * 100).toFixed(0)
    const queryShort = testCase.query.length > 30 ? testCase.query.slice(0, 30) + '...' : testCase.query

    console.log('[' + (i + 1) + '/' + testCases.length + '] ' + status + ' ' + testCase.id + ' - 得分: ' + score + '% - ' + result.latency + 'ms - ' + queryShort)
  }

  console.log('')

  return generateReport(results, latencies)
}

function generateReport(results: TestResult[], latencies: number[]): TestReport {
  const totalCases = results.length
  const passedCases = results.filter(r => r.success).length
  const failedCases = totalCases - passedCases
  const passRate = totalCases > 0 ? passedCases / totalCases : 0
  const overallScore = calculateAverageScore(results)
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
  const p95Latency = calculateP95Latency(latencies)

  const byCategory: Record<string, any> = {}
  const categories = [...new Set(results.map(r => r.category))]

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category)
    const categoryPassed = categoryResults.filter(r => r.success).length

    byCategory[category] = {
      total: categoryResults.length,
      passed: categoryPassed,
      passRate: categoryPassed / categoryResults.length,
      avgScore: calculateAverageScore(categoryResults),
    }
  }

  const byDifficulty: Record<string, any> = {}
  const difficulties = [...new Set(results.map(r => r.difficulty))]

  for (const difficulty of difficulties) {
    const difficultyResults = results.filter(r => r.difficulty === difficulty)
    const difficultyPassed = difficultyResults.filter(r => r.success).length

    byDifficulty[difficulty] = {
      total: difficultyResults.length,
      passed: difficultyPassed,
      passRate: difficultyPassed / difficultyResults.length,
      avgScore: calculateAverageScore(difficultyResults),
    }
  }

  const report: TestReport = {
    summary: {
      totalCases,
      passedCases,
      failedCases,
      passRate,
      overallScore,
      avgLatency,
      p95Latency,
    },
    byCategory,
    byDifficulty,
    details: results,
    recommendations: [],
  }

  report.recommendations = generateRecommendations(report)

  return report
}

// ==================== 报告格式化 ====================

export function formatReportAsText(report: TestReport): string {
  const lines: string[] = []

  lines.push('='.repeat(60))
  lines.push('                    RAG 召回测试报告')
  lines.push('='.repeat(60))
  lines.push('')

  lines.push('📊 测试概览')
  lines.push('-'.repeat(40))
  lines.push('  总用例数:    ' + report.summary.totalCases)
  lines.push('  通过数:      ' + report.summary.passedCases)
  lines.push('  失败数:      ' + report.summary.failedCases)
  lines.push('  通过率:      ' + (report.summary.passRate * 100).toFixed(1) + '%')
  lines.push('  综合得分:    ' + (report.summary.overallScore * 100).toFixed(1) + '%')
  lines.push('  平均延迟:    ' + report.summary.avgLatency.toFixed(0) + 'ms')
  lines.push('  P95延迟:     ' + report.summary.p95Latency.toFixed(0) + 'ms')
  lines.push('')

  let grade = '不及格'
  if (report.summary.overallScore >= TEST_CONFIG.thresholds.excellent) grade = '优秀 ⭐⭐⭐'
  else if (report.summary.overallScore >= TEST_CONFIG.thresholds.good) grade = '良好 ⭐⭐'
  else if (report.summary.overallScore >= TEST_CONFIG.thresholds.fair) grade = '及格 ⭐'

  lines.push('🏆 等级评定: ' + grade)
  lines.push('')

  lines.push('📁 按分类统计')
  lines.push('-'.repeat(40))
  for (const [category, stats] of Object.entries(report.byCategory)) {
    const passRate = (stats.passRate * 100).toFixed(0)
    const bar = '█'.repeat(Math.round(stats.passRate * 20))
    lines.push('  ' + category.padEnd(12) + stats.passed + '/' + stats.total + '  ' + bar + ' ' + passRate + '%  (得分: ' + (stats.avgScore * 100).toFixed(0) + '%)')
  }
  lines.push('')

  lines.push('📈 按难度统计')
  lines.push('-'.repeat(40))
  for (const [difficulty, stats] of Object.entries(report.byDifficulty)) {
    const passRate = (stats.passRate * 100).toFixed(0)
    const bar = '█'.repeat(Math.round(stats.passRate * 20))
    lines.push('  ' + difficulty.padEnd(12) + stats.passed + '/' + stats.total + '  ' + bar + ' ' + passRate + '%  (得分: ' + (stats.avgScore * 100).toFixed(0) + '%)')
  }
  lines.push('')

  const failedCases = report.details.filter(r => !r.success)
  if (failedCases.length > 0) {
    lines.push('❌ 失败用例')
    lines.push('-'.repeat(40))
    for (const result of failedCases) {
      lines.push('  [' + result.caseId + '] ' + result.query)
      for (const issue of result.evaluation.issues) {
        lines.push('      ⚠️  ' + issue)
      }
      lines.push('      得分: ' + (result.evaluation.relevanceScore * 100).toFixed(0) + '% | 延迟: ' + result.latency + 'ms')
      lines.push('')
    }
  }

  lines.push('💡 优化建议')
  lines.push('-'.repeat(40))
  for (let i = 0; i < report.recommendations.length; i++) {
    lines.push('  ' + (i + 1) + '. ' + report.recommendations[i])
  }
  lines.push('')

  lines.push('='.repeat(60))
  lines.push('报告生成时间: ' + new Date().toLocaleString('zh-CN'))
  lines.push('='.repeat(60))

  return lines.join('\n')
}

export function formatReportAsMarkdown(report: TestReport): string {
  const lines: string[] = []

  lines.push('# RAG 召回测试报告\n')
  lines.push('> 生成时间: ' + new Date().toLocaleString('zh-CN') + '\n')

  lines.push('## 📊 测试概览\n')
  lines.push('| 指标 | 数值 |')
  lines.push('|------|------|')
  lines.push('| 总用例数 | ' + report.summary.totalCases + ' |')
  lines.push('| 通过数 | ' + report.summary.passedCases + ' |')
  lines.push('| 失败数 | ' + report.summary.failedCases + ' |')
  lines.push('| **通过率** | **' + (report.summary.passRate * 100).toFixed(1) + '%** |')
  lines.push('| **综合得分** | **' + (report.summary.overallScore * 100).toFixed(1) + '%** |')
  lines.push('| 平均延迟 | ' + report.summary.avgLatency.toFixed(0) + 'ms |')
  lines.push('| P95延迟 | ' + report.summary.p95Latency.toFixed(0) + 'ms |')

  let grade = '不及格'
  let gradeColor = 'red'
  if (report.summary.overallScore >= TEST_CONFIG.thresholds.excellent) {
    grade = '优秀 ⭐⭐⭐'
    gradeColor = 'green'
  } else if (report.summary.overallScore >= TEST_CONFIG.thresholds.good) {
    grade = '良好 ⭐⭐'
    gradeColor = 'yellow'
  } else if (report.summary.overallScore >= TEST_CONFIG.thresholds.fair) {
    grade = '及格 ⭐'
    gradeColor = 'orange'
  }

  lines.push('\n### 🏆 等级评定\n<span style="color:' + gradeColor + ';font-size:1.2em">' + grade + '</span>\n')

  lines.push('\n## 📁 按分类统计\n')
  lines.push('| 分类 | 总数 | 通过 | 通过率 | 平均得分 |')
  lines.push('|------|------|------|--------|----------|')
  for (const [category, stats] of Object.entries(report.byCategory)) {
    const passRate = (stats.passRate * 100).toFixed(0)
    const avgScore = (stats.avgScore * 100).toFixed(0)
    lines.push('| ' + category + ' | ' + stats.total + ' | ' + stats.passed + ' | ' + passRate + '% | ' + avgScore + '% |')
  }

  lines.push('\n## 📈 按难度统计\n')
  lines.push('| 难度 | 总数 | 通过 | 通过率 | 平均得分 |')
  lines.push('|------|------|------|--------|----------|')
  for (const [difficulty, stats] of Object.entries(report.byDifficulty)) {
    const passRate = (stats.passRate * 100).toFixed(0)
    const avgScore = (stats.avgScore * 100).toFixed(0)
    lines.push('| ' + difficulty + ' | ' + stats.total + ' | ' + stats.passed + ' | ' + passRate + '% | ' + avgScore + '% |')
  }

  const failedCases = report.details.filter(r => !r.success)
  if (failedCases.length > 0) {
    lines.push('\n## ❌ 失败用例详情\n')
    for (const result of failedCases) {
      const docFound = result.metrics.documentFound ? 1 : 0
      lines.push('### [' + result.caseId + '] ' + result.query + '\n')
      lines.push('- **分类**: ' + result.category)
      lines.push('- **难度**: ' + result.difficulty)
      lines.push('- **得分**: ' + (result.evaluation.relevanceScore * 100).toFixed(0) + '%')
      lines.push('- **召回结果**: ' + result.metrics.totalResults + ' (Doc: ' + docFound + ', Parent: ' + result.metrics.parentCount + ', Child: ' + result.metrics.childCount + ')')
      lines.push('- **延迟**: ' + result.latency + 'ms')
      lines.push('- **问题**:')
      for (const issue of result.evaluation.issues) {
        lines.push('  - ' + issue)
      }
      lines.push('')
    }
  }

  lines.push('\n## 💡 优化建议\n')
  for (let i = 0; i < report.recommendations.length; i++) {
    lines.push((i + 1) + '. ' + report.recommendations[i])
  }

  return lines.join('\n')
}

// ==================== CLI 入口 ====================

async function main() {
  const userId = process.env.TEST_USER_ID || 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'
  const kbId = process.env.TEST_KB_ID
  const categories = process.env.TEST_CATEGORIES?.split(',')
  const outputFormat = process.env.TEST_OUTPUT_FORMAT || 'text'

  const report = await runAllTests({
    userId,
    kbId,
    categories,
  })

  if (outputFormat === 'markdown') {
    console.log(formatReportAsMarkdown(report))
  } else if (outputFormat === 'json') {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(formatReportAsText(report))
  }

  process.exit(report.summary.passRate >= TEST_CONFIG.thresholds.fair ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('测试执行失败:', error)
    process.exit(1)
  })
}

export { main }

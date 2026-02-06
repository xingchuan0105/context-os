/**
 * 完整版 K-Type 分析（带计时）
 *
 * 使用 LiteLLM + Qwen Flash (997K 上下文)
 * 全量分块模式：按最大长度切块后逐块分析
 * 输出顺序：执行摘要 -> 相关标签 -> 分类信息 -> 认知特征 -> 知识模块
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import { parsePDF } from '../lib/parsers/pdf.js'
// 使用 LiteLLM + Qwen Flash
import { processKTypeWorkflowEfficient, KTypeProcessResult } from '../lib/processors/k-type-efficient-vercel.ts'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })


// 计时器类
class Timer {
  private startTime: number = 0
  private laps: Map<string, number> = new Map()

  start() {
    this.startTime = Date.now()
    this.laps.clear()
  }

  lap(label: string): number {
    const now = Date.now()
    const elapsed = now - this.startTime
    this.laps.set(label, elapsed)
    return elapsed
  }

  getLaps(): Map<string, number> {
    return new Map(this.laps)
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}m`
  }
}

async function main() {
  const timer = new Timer()
  timer.start()

  console.log(' K-Type 分析（LiteLLM + Qwen Flash）')
  console.log(`模型: qwen-flash (997K 上下文)`)
  console.log(`API: ${process.env.LITELLM_BASE_URL || 'http://localhost:4000'}`)
  console.log('')

  try {
    // ==================== 阶段 1: PDF 解析 ====================
    console.log(' 阶段 1/3: PDF 解析')
    console.log('────────────────────────────────────────')

    const inputArg = process.argv[2] || '../test.pdf'
    const pdfPath = resolve(__dirname, inputArg)
    const fileBuffer = readFileSync(pdfPath)

    timer.lap('start_parse')
    const pdfData = new Uint8Array(fileBuffer)

    const parseResult = await parsePDF(pdfData.buffer)
    const parseTime = timer.lap('parse_complete')

    console.log(` 解析完成`)
    console.log(`   文件大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   页数: ${parseResult.metadata?.pages || 0}`)
    console.log(`   文本长度: ${parseResult.content.length.toLocaleString()} 字符`)
    console.log(`   耗时: ${timer.formatTime(parseTime)}`)
    console.log('')

    // ==================== 阶段 2: K-Type 分析 ====================
    console.log(' 阶段 2/3: K-Type 分析')
    console.log('────────────────────────────────────────')
    console.log('   模型: qwen-flash (997K 上下文)')
    console.log('   模式: LiteLLM，全量分块模式')
    console.log('')

    timer.lap('start_ktype')
    const ktypeResult = await processKTypeWorkflowEfficient(parseResult.content)
    const ktypeTime = timer.lap('ktype_complete')

    console.log(` 分析完成`)
    console.log(`   主导类型: ${ktypeResult.finalReport.classification.dominantType.join(', ') || '无'}`)
    console.log(`   耗时: ${timer.formatTime(ktypeTime)}`)
    console.log('')

    // ==================== 阶段 3: 生成报告 ====================
    console.log(' 阶段 3/3: 生成报告')
    console.log('────────────────────────────────────────')

    timer.lap('start_report')

    const fs = await import('fs')
    const outputPath = resolve(__dirname, 'KTYPE_LLM_OUTPUT.txt')

    const totalTime = Date.now() - timer.startTime

    // ????
    const rawOutput = (ktypeResult as any).rawOutput
    const report = rawOutput ? JSON.stringify(rawOutput, null, 2) : JSON.stringify(ktypeResult, null, 2)
    fs.writeFileSync(outputPath, report, 'utf-8')
    const reportTime = timer.lap('report_complete')

    console.log(` 报告生成完成`)
    console.log(`   文件: ${outputPath}`)
    console.log(`   耗时: ${timer.formatTime(reportTime)}`)
    console.log('')

    // ==================== 显示统计 ====================
    console.log(' 执行摘要')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(` 总耗时: ${timer.formatTime(totalTime)}`)
    console.log(`   - PDF 解析: ${timer.formatTime(parseTime)}`)
    console.log(`   - K-Type 分析: ${timer.formatTime(ktypeTime)}`)
    console.log(`   - 报告生成: ${timer.formatTime(reportTime)}`)
    console.log('')
    console.log(' LLM 输出内容:')
    console.log(`   - 执行摘要: ${ktypeResult.finalReport.executiveSummary.length} 字符`)
    console.log(`   - 相关标签: ${ktypeResult.relatedTags?.length || 0} 个`)
    console.log(`   - 知识模块: ${ktypeResult.finalReport.knowledgeModules.length} 个`)
    console.log(`   - 精华摘要: ${ktypeResult.finalReport.distilledContent.length} 字符`)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(' 完成！输出已保存到:')
    console.log(`   ${outputPath}`)
    console.log('')

  } catch (error: any) {
    console.error('')
    console.error(' 错误:', error.message)
    console.error('')
    console.error('堆栈跟踪:')
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * 生成报告（兼容新接口：执行摘要 -> 相关标签 -> 分类信息 -> 认知扫描 -> 知识模块 -> 精华摘要）
 */
function generateReport(result: KTypeProcessResult): string {
  const { finalReport, relatedTags } = result
  const lines: string[] = []

  // ==================== 执行摘要 ====================
  lines.push('='.repeat(80))
  lines.push('执行摘要')
  lines.push('='.repeat(80))
  lines.push('')
  lines.push(finalReport.executiveSummary || '[未生成]')
  lines.push('')

  // ==================== 相关标签 ====================
  lines.push('='.repeat(80))
  lines.push('相关标签')
  lines.push('='.repeat(80))
  lines.push('')
  if (relatedTags && relatedTags.length > 0) {
    relatedTags.forEach((tag, i) => {
      lines.push(`${i + 1}. ${tag}`)
    })
  } else {
    lines.push('[未生成标签]')
  }
  lines.push('')
  lines.push('')

  // ==================== 分类信息 ====================
  lines.push('='.repeat(80))
  lines.push('分类信息')
  lines.push('='.repeat(80))
  lines.push('')
  lines.push('类型评分:')
  const scores = finalReport.classification.scores
  lines.push(`  - 程序行动型 (Procedural):    ${scores.procedural}/10`)
  lines.push(`  - 概念分类型 (Conceptual):    ${scores.conceptual}/10`)
  lines.push(`  - 推理因果型 (Reasoning):     ${scores.reasoning}/10`)
  lines.push(`  - 系统本体型 (Systemic):      ${scores.systemic}/10`)
  lines.push(`  - 体验叙事型 (Narrative):     ${scores.narrative}/10`)
  lines.push('')
  lines.push('分类理由:')
  lines.push(finalReport.classification.reason || '[未生成]')
  lines.push('')
  lines.push('')

  // ==================== 认知扫描 (Scan Trace) ====================
  lines.push('='.repeat(80))
  lines.push('认知扫描')
  lines.push('='.repeat(80))
  lines.push('')
  lines.push(`DIKW 层级: ${finalReport.scanTrace.dikwLevel || '[未生成]'}`)
  lines.push(`显隐知识比例: ${finalReport.scanTrace.tacitExplicitRatio || '[未生成]'}`)
  lines.push(`逻辑模式: ${finalReport.scanTrace.logicPattern || '[未生成]'}`)
  lines.push('')
  if (finalReport.scanTrace.evidence && finalReport.scanTrace.evidence.length > 0) {
    lines.push('原文证据:')
    finalReport.scanTrace.evidence.forEach((evidence, i) => {
      lines.push(`  ${i + 1}. ${evidence.slice(0, 100)}${evidence.length > 100 ? '...' : ''}`)
    })
  }
  lines.push('')
  lines.push('')

  // ==================== 知识模块 ====================
  lines.push('='.repeat(80))
  lines.push('知识模块')
  lines.push('='.repeat(80))
  lines.push('')

  if (finalReport.knowledgeModules && finalReport.knowledgeModules.length > 0) {
    finalReport.knowledgeModules.forEach((module, idx) => {
      lines.push(`--- 模块 ${idx + 1}: ${module.type} (评分: ${module.score}/10) ---`)
      lines.push('')
      lines.push(`核心价值: ${module.coreValue}`)
      lines.push('')
      lines.push('内容:')
      lines.push(module.content)
      lines.push('')
      if (module.evidence && module.evidence.length > 0) {
        lines.push('原文证据:')
        module.evidence.forEach((evidence) => {
          lines.push(`  - ${evidence.slice(0, 80)}${evidence.length > 80 ? '...' : ''}`)
        })
        lines.push('')
      }
    })
  } else {
    lines.push('[没有知识模块]')
  }
  lines.push('')

  // ==================== 精华摘要 ====================
  lines.push('='.repeat(80))
  lines.push('精华摘要')
  lines.push('='.repeat(80))
  lines.push('')
  lines.push(finalReport.distilledContent || '[未生成]')
  lines.push('')

  return lines.join('\n')
}

main()

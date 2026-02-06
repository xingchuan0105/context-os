/**
 * 生成完整的 K-Type 分析报告
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import { parsePDF } from '../lib/parsers/pdf.js'
import { processKTypeWorkflowWithFallback } from '../lib/processors/k-type.js'
import { buildKTypeSummaryText, buildKTypeMetadata } from '../lib/processors/k-type-summary.js'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

async function main() {
  console.log('📊 生成完整 K-Type 分析报告')
  console.log('')

  try {
    // 读取 PDF
    const pdfPath = resolve(__dirname, '../test.pdf')
    const fileBuffer = readFileSync(pdfPath)
    const pdfData = new Uint8Array(fileBuffer)

    console.log('📄 步骤 1/4: 解析 PDF...')
    const parseResult = await parsePDF(pdfData.buffer)
    console.log(`✅ 解析成功: ${parseResult.content.length} 字符, ${parseResult.metadata?.pages || 0} 页`)

    console.log('')
    console.log('🔄 步骤 2/4: K-Type 分析...')
    const ktypeResult = await processKTypeWorkflowWithFallback(parseResult.content)
    console.log('✅ 分析完成')

    console.log('')
    console.log('📝 步骤 3/4: 生成摘要和元数据...')
    const ktypeSummary = buildKTypeSummaryText(ktypeResult)
    const ktypeMetadata = buildKTypeMetadata(ktypeResult)
    console.log('✅ 生成完成')

    // 保存完整报告
    console.log('')
    console.log('💾 步骤 4/4: 保存报告...')

    const fs = await import('fs')
    const outputPath = resolve(__dirname, 'KTYPE_FULL_REPORT.txt')

    const report = `
╔════════════════════════════════════════════════════════════════════════════╗
║                        K-TYPE 完整分析报告                                    ║
║                                                                            ║
║ 文件: test.pdf                                                              ║
║ 大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB (${(fileBuffer.length).toLocaleString()} 字节)                         ║
║ 页数: ${parseResult.metadata?.pages || 0} 页                                                                 ║
║ 文本长度: ${parseResult.content.length.toLocaleString()} 字符                                                          ║
║ 生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}                       ║
╚════════════════════════════════════════════════════════════════════════════╝

┌────────────────────────────────────────────────────────────────────────────┐
│ 1. 执行摘要                                                                  │
└────────────────────────────────────────────────────────────────────────────┘

${ktypeSummary}

┌────────────────────────────────────────────────────────────────────────────┐
│ 2. 类型分布详细分析                                                          │
└────────────────────────────────────────────────────────────────────────────┘

主导类型: ${ktypeMetadata.dominant_type}
主导类型列表: ${ktypeMetadata.dominant_types.join(', ')}

五大类型评分:

  🔷 Theory (理论/概念):      ${ktypeMetadata.type_scores.conceptual}/10
     ${generateBar(ktypeMetadata.type_scores.conceptual)}
     ${getTypeDescription('conceptual', ktypeMetadata.type_scores.conceptual)}

  🔶 Procedure (操作步骤):    ${ktypeMetadata.type_scores.procedural}/10
     ${generateBar(ktypeMetadata.type_scores.procedural)}
     ${getTypeDescription('procedural', ktypeMetadata.type_scores.procedural)}

  🔷 System (系统架构):       ${ktypeMetadata.type_scores.systemic}/10
     ${generateBar(ktypeMetadata.type_scores.systemic)}
     ${getTypeDescription('systemic', ktypeMetadata.type_scores.systemic)}

  🔷 Reasoning (推理分析):    ${ktypeMetadata.type_scores.reasoning}/10
     ${generateBar(ktypeMetadata.type_scores.reasoning)}
     ${getTypeDescription('reasoning', ktypeMetadata.type_scores.reasoning)}

  🟣 Narrative (叙事描述):    ${ktypeMetadata.type_scores.narrative}/10
     ${generateBar(ktypeMetadata.type_scores.narrative)}
     ${getTypeDescription('narrative', ktypeMetadata.type_scores.narrative)}

┌────────────────────────────────────────────────────────────────────────────┐
│ 3. 认知特征分析                                                              │
└────────────────────────────────────────────────────────────────────────────┘

DIKW 层级: ${ktypeMetadata.dikw_level}
${getDIKWDescription(ktypeMetadata.dikw_level)}

逻辑模式: ${ktypeMetadata.logic_pattern}
${getLogicPatternDescription(ktypeMetadata.logic_pattern)}

┌────────────────────────────────────────────────────────────────────────────┐
│ 4. 知识模块分解                                                              │
└────────────────────────────────────────────────────────────────────────────┘

${ktypeMetadata.knowledge_modules && ktypeMetadata.knowledge_modules.length > 0
  ? ktypeMetadata.knowledge_modules.map((module, idx) =>
      module ? `模块 ${idx + 1}: ${module}` : '模块 ' + (idx + 1) + ': [未提取]'
    ).join('\n')
  : '知识模块: [未启用或提取失败]'}
注: 知识模块分解需要在完整 K-Type 工作流中启用，当前为快速模式

┌────────────────────────────────────────────────────────────────────────────┐
│ 5. 完整元数据 (JSON)                                                         │
└────────────────────────────────────────────────────────────────────────────┘

${JSON.stringify(ktypeMetadata, null, 2)}

┌────────────────────────────────────────────────────────────────────────────┐
│ 6. 原始文本统计                                                              │
└────────────────────────────────────────────────────────────────────────────┘

总字符数: ${parseResult.content.length.toLocaleString()}
总词数估计: ${estimateWordCount(parseResult.content).toLocaleString()}
段落数: ${parseResult.content.split('\n\n').length}
平均句子长度: ${estimateAvgSentenceLength(parseResult.content)} 字符

┌────────────────────────────────────────────────────────────────────────────┐
│ 7. 文档内容样本（前 2000 字符）                                             │
└────────────────────────────────────────────────────────────────────────────┘

${parseResult.content.substring(0, 2000)}...

┌────────────────────────────────────────────────────────────────────────────┐
│ 8. 应用建议                                                                  │
└────────────────────────────────────────────────────────────────────────────┘

${generateRecommendations(ktypeMetadata)}

╔════════════════════════════════════════════════════════════════════════════╗
║                              报告结束                                        ║
╚════════════════════════════════════════════════════════════════════════════╝
`

    fs.writeFileSync(outputPath, report, 'utf-8')
    console.log(`✅ 报告已保存到: ${outputPath}`)
    console.log('')

    // 显示执行摘要
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 执行摘要')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(`主导类型: ${ktypeMetadata.dominant_type}`)
    console.log(`DIKW 层级: ${ktypeMetadata.dikw_level}`)
    console.log(`逻辑模式: ${ktypeMetadata.logic_pattern}`)
    console.log('')
    console.log('类型分布:')
    console.log(`  • 理论概念: ${'█'.repeat(ktypeMetadata.type_scores.conceptual)}${'░'.repeat(10 - ktypeMetadata.type_scores.conceptual)} ${ktypeMetadata.type_scores.conceptual}/10`)
    console.log(`  • 操作步骤: ${'█'.repeat(ktypeMetadata.type_scores.procedural)}${'░'.repeat(10 - ktypeMetadata.type_scores.procedural)} ${ktypeMetadata.type_scores.procedural}/10`)
    console.log(`  • 系统架构: ${'█'.repeat(ktypeMetadata.type_scores.systemic)}${'░'.repeat(10 - ktypeMetadata.type_scores.systemic)} ${ktypeMetadata.type_scores.systemic}/10`)
    console.log(`  • 推理分析: ${'█'.repeat(ktypeMetadata.type_scores.reasoning)}${'░'.repeat(10 - ktypeMetadata.type_scores.reasoning)} ${ktypeMetadata.type_scores.reasoning}/10`)
    console.log(`  • 叙事描述: ${'█'.repeat(ktypeMetadata.type_scores.narrative)}${'░'.repeat(10 - ktypeMetadata.type_scores.narrative)} ${ktypeMetadata.type_scores.narrative}/10`)
    console.log('')

  } catch (error: any) {
    console.error('❌ 错误:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 辅助函数
function generateBar(score: number): string {
  const filled = '█'.repeat(score)
  const empty = '░'.repeat(10 - score)
  return `[${filled}${empty}]`
}

function getTypeDescription(type: string, score: number): string {
  const descriptions: Record<string, Record<number, string>> = {
    conceptual: {
      9: '强理论性，包含大量概念、定义、原理',
      8: '明显理论倾向',
      7: '中等理论性',
      6: '轻度理论性',
      5: '弱理论性'
    },
    procedural: {
      9: '强操作性，详细步骤和流程',
      8: '明显操作指导',
      7: '中等操作内容',
      6: '轻度操作步骤',
      5: '弱操作性'
    },
    systemic: {
      9: '强系统性，复杂架构和关系',
      8: '明显系统设计',
      7: '中等系统性',
      6: '轻度系统内容',
      5: '弱系统性'
    },
    reasoning: {
      9: '强推理，复杂逻辑和分析',
      8: '明显推理过程',
      7: '中等推理性',
      6: '轻度推理',
      5: '弱推理性'
    },
    narrative: {
      9: '强叙事，故事性强',
      8: '明显叙事特征',
      7: '中等叙事性',
      6: '轻度叙事',
      5: '弱叙事性'
    }
  }

  return descriptions[type]?.[score] || descriptions[type]?.[5] || '未知类型'
}

function getDIKWDescription(level: string): string {
  const descriptions: Record<string, string> = {
    'Data': '数据层 - 包含原始事实和观测',
    'Information': '信息层 - 数据经过组织和处理',
    'Knowledge': '知识层 - 理解、规律和原则',
    'Wisdom': '智慧层 - 深刻洞察和判断力'
  }
  return descriptions[level] || '未知层级'
}

function getLogicPatternDescription(pattern: string): string {
  const descriptions: Record<string, string> = {
    '概念解释->设计原则->实践指南': '从理论到实践的完整知识传递',
    '概念解释->示例说明->实践指导': '理论结合实例的教学模式',
    '问题引入->解决方案->实施步骤': '问题驱动的实践导向',
    '背景介绍->核心概念->应用场景': '应用导向的知识介绍'
  }
  return descriptions[pattern] || '自定义逻辑模式'
}

function estimateWordCount(text: string): number {
  // 简单的词数估计（中英文混合）
  const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0
  return englishWords + chineseChars
}

function estimateAvgSentenceLength(text: number): string {
  const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0)
  if (sentences.length === 0) return '0'
  const avgLength = text.length / sentences.length
  return avgLength.toFixed(1)
}

function generateRecommendations(metadata: any): string {
  const recommendations: string[] = []

  // 基于 dominant type
  if (metadata.dominant_type === 'conceptual') {
    recommendations.push('✓ 适合作为技术参考书和理论知识库')
    recommendations.push('✓ 建议使用小粒度分块以保留概念的完整性')
  } else if (metadata.dominant_type === 'procedural') {
    recommendations.push('✓ 适合作为操作手册和快速指南')
    recommendations.push('✓ 建议保留步骤的顺序关系')
  }

  // 基于 DIKW 层级
  if (metadata.dikw_level === 'Knowledge') {
    recommendations.push('✓ 适合知识管理系统和专家系统')
    recommendations.push('✓ 可以用于生成问答对和知识图谱')
  }

  // 基于类型分数
  const scores = metadata.type_scores
  if (scores.conceptual >= 8 && scores.procedural >= 7) {
    recommendations.push('✓ 理论与实践结合良好，适合全流程学习')
  }

  if (scores.systemic >= 8) {
    recommendations.push('✓ 包含复杂的系统架构，建议保留结构关系')
  }

  if (scores.reasoning >= 7) {
    recommendations.push('✓ 包含推理过程，适合用于演示思维链')
  }

  return recommendations.length > 0
    ? recommendations.map(r => `  ${r}`).join('\n')
    : '  基于分析结果暂无特定建议'
}

main()

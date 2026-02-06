#!/usr/bin/env tsx
/**
 * 解析单个文件 -> K-Type 报告 -> 写入 Markdown，方便人工复核。
 * 用法：tsx scripts/export-ktype-report.ts "<文件路径>"
 */

import { config } from 'dotenv'
import { resolve, basename, extname } from 'path'
import { writeFileSync } from 'fs'

config({ path: resolve(__dirname, '../.env.local') })

import { parseFile } from '../lib/parsers'
import { processKTypeWorkflowWithFallback } from '../lib/processors'

async function main() {
  const fileArg = process.argv[2]
  if (!fileArg) {
    console.error('请提供文件路径，例如: tsx scripts/export-ktype-report.ts "./Context OS  PRD.docx"')
    process.exit(1)
  }

  const filePath = resolve(fileArg)
  const filename = basename(filePath)
  const ext = extname(filePath).toLowerCase()

  console.log(`开始处理: ${filePath}`)

  const buffer = await (await import('fs')).promises.readFile(filePath)
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
  }
  const mimeType = mimeMap[ext] || 'application/octet-stream'

  const parseResult = await parseFile(buffer, mimeType, filename)
  console.log(`解析完成，字符数=${parseResult.content.length}`)

  const ktype = await processKTypeWorkflowWithFallback(parseResult.content)
  const fr = ktype.finalReport

  const mdParts: string[] = []
  mdParts.push(`# K-Type 报告 - ${filename}`)
  mdParts.push('')
  mdParts.push(`**Executive Summary**`)
  mdParts.push(fr?.executiveSummary || '')
  mdParts.push('')
  mdParts.push(`**Related Tags:** ${(fr?.relatedTags || []).join(', ')}`)
  mdParts.push('')
  mdParts.push(`## Classification Scores`)
  const scores = fr?.classification?.scores || {}
  mdParts.push(`- procedural: ${scores.procedural ?? ''}`)
  mdParts.push(`- conceptual: ${scores.conceptual ?? ''}`)
  mdParts.push(`- reasoning: ${scores.reasoning ?? ''}`)
  mdParts.push(`- systemic: ${scores.systemic ?? ''}`)
  mdParts.push(`- narrative: ${scores.narrative ?? ''}`)
  if (fr?.classification?.reason) {
    mdParts.push(`- reason: ${fr.classification.reason}`)
  }
  mdParts.push('')
  mdParts.push(`## Scan Trace`)
  mdParts.push(`- DIKW Level: ${fr?.scanTrace?.dikwLevel || ''}`)
  mdParts.push(`- Tacit/Explicit Ratio: ${fr?.scanTrace?.tacitExplicitRatio || ''}`)
  mdParts.push(`- Logic Pattern: ${fr?.scanTrace?.logicPattern || ''}`)
  if (fr?.scanTrace?.evidence?.length) {
    mdParts.push(`- Evidence:`)
    fr.scanTrace.evidence.forEach(e => mdParts.push(`  - ${e}`))
  }
  mdParts.push('')
  mdParts.push(`## Knowledge Modules`)
  if (fr?.knowledgeModules?.length) {
    fr.knowledgeModules.forEach(m => {
      mdParts.push(`- **${m.type} (${m.score})** ${m.coreValue || ''}`)
      mdParts.push(`  - Content: ${m.content || ''}`)
      if (m.evidence?.length) mdParts.push(`  - Evidence: ${m.evidence.join(' / ')}`)
      if (m.sourcePreview) mdParts.push(`  - Source Preview: ${m.sourcePreview}`)
    })
  } else {
    mdParts.push('- (empty)')
  }
  mdParts.push('')
  mdParts.push(`## Distilled Content`)
  mdParts.push(fr?.distilledContent || '')

  const outputPath = resolve(__dirname, '../tmp/ktype-report.md')
  writeFileSync(outputPath, mdParts.join('\n'), 'utf8')
  console.log(`已输出: ${outputPath}`)
}

main().catch(err => {
  console.error('导出失败:', err)
  process.exit(1)
})

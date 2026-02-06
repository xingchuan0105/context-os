#!/usr/bin/env tsx
/**
 * 从 .tmp-run.log 中提取最近一次 LiteLLM 返回的 content，并写入干净的 Markdown 便于复核。
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const log = readFileSync(resolve('.tmp-run.log'), 'utf8').split(/\r?\n/)

// 从最后一个包含 "LiteLLM raw completion" 的行提取 JSON
const rawLine = [...log].reverse().find(line => line.includes('LiteLLM raw completion'))
if (!rawLine) {
  console.error('未找到 raw completion 行')
  process.exit(1)
}
const idx = rawLine.indexOf('{')
if (idx < 0) {
  console.error('raw completion 行未包含 JSON')
  process.exit(1)
}
const rawJson = rawLine.slice(idx)

let outer: any
try {
  outer = JSON.parse(rawJson)
} catch (e) {
  console.error('解析 raw completion 失败:', e)
  process.exit(1)
}

const content: string = outer?.choices?.[0]?.message?.content || ''
if (!content) {
  console.error('未找到 content')
  process.exit(1)
}

let obj: any
try {
  obj = JSON.parse(content)
} catch (e) {
  console.error('解析 content JSON 失败:', e)
  process.exit(1)
}

const fr = {
  executive_summary: obj.executive_summary || '',
  related_tags: obj.related_tags || [],
  classification: obj.classification || {},
  scan_trace: obj.scan_trace || {},
  cognitive_features: obj.cognitive_features || {},
  knowledge_modules: obj.knowledge_modules || [],
  distilled_content: obj.distilled_content || '',
}

const md: string[] = []
md.push('# K-Type 报告（从 .tmp-run.log 提取）')
md.push('')
md.push('## Executive Summary')
md.push(fr.executive_summary)
md.push('')
md.push('## Related Tags')
md.push((fr.related_tags || []).join(', '))
md.push('')
md.push('## Classification')
md.push(JSON.stringify(fr.classification, null, 2))
md.push('')
md.push('## Scan Trace')
md.push(JSON.stringify(fr.scan_trace, null, 2))
md.push('')
md.push('## Cognitive Features')
md.push(JSON.stringify(fr.cognitive_features, null, 2))
md.push('')
md.push('## Knowledge Modules')
md.push(JSON.stringify(fr.knowledge_modules, null, 2))
md.push('')
md.push('## Distilled Content')
md.push(fr.distilled_content)

const outPath = resolve('tmp/ktype-report-clean.md')
writeFileSync(outPath, md.join('\n'), 'utf8')
console.log('已输出:', outPath)

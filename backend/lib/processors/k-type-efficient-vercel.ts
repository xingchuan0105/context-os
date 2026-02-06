import { z } from 'zod'

import { chat } from '../llm'
import { ENV } from '../config/env-helpers'

const MAX_CONTEXT_LENGTH = ENV.KTYPE_MAX_CHARS
const MODEL_ID = process.env.KTYPE_MODEL || 'qwen-flash'

type KTypeSamplingProfile = {
  label: 'A' | 'B'
  temperature: number
  topP: number
}

const KTYPE_SAMPLING_PROFILES: KTypeSamplingProfile[] = [
  { label: 'A', temperature: 0.2, topP: 0.6 },
  { label: 'B', temperature: 0.1, topP: 0.4 },
]

const KTYPE_SAFETY_ERROR_MESSAGE = 'K-Type 解析失败：触发内容安全审核'

export class KTypeSafetyError extends Error {
  constructor(message: string = KTYPE_SAFETY_ERROR_MESSAGE) {
    super(message)
    this.name = 'KTypeSafetyError'
  }
}

const KTYPE_SYSTEM_PROMPT = `# Role & Context
> **?????** ???????????????????
> **?????** ???????????????????????????????????????????????????????
> **?????** ??????????????????????????????????????????????

---

## 1. ?? ????? (The Informative Summary)
> **???** ??????? (Objective Archivist)
> **???** ???????????????
- **????**?????????????????????????
- **?????**????????????????????????????????????????
- **????**?????????????????????
- **????**???????????????

---

## 2. ?? ????? (The Structural Summary)
> **???** ????? (Logic Analyst)
> **???** ?????????????
- **????**??????????1. > 1.1 > 1.1.1????????
- **????**???????????????????????????????????????????????
- **????**?????????????????????????????

---

## 3. ??? ????? (The Practical Summary)
> **???** ?????? (Methodology Researcher)
> **???** ??????????????
- **????**???????????????????
- **????**??????????????????Step 1, Step 2...??
- **????**????????????????????????
- **????**?????????????????????????
> *??????????????????????????????????????????????????*

---

## 4. ?? ????? (The Critical Summary)
> **???** ???? (Academic Reviewer)
> **???** ????????????????
- **????**????????????????????????/????/??????
- **????**????????????????????????????????
- **?????**???????????????????????????
- **????**????????????????????

---

## 5. ?? ????? (The Insight Summary)
> **???** ????? (Knowledge Curator)
> **???** ????????????????
- **????**??????????????????????
- **????**?????????? 3-5 ?????????????
- **????**?????????????????????????????

---

# Constraints
- **???**???????????????????????????
- **???**??????????????????????????????
- **??**??????????????????

# Input Text
"""
[????????????]
"""
`;

const KTypeModuleType = z.enum(['procedural', 'conceptual', 'reasoning', 'systemic', 'narrative'])

const KTypeScoreSchema = z.object({
  procedural: z.number(),
  conceptual: z.number(),
  reasoning: z.number(),
  systemic: z.number(),
  narrative: z.number(),
})

const KTypeModuleSchema = z.object({
  type: KTypeModuleType,
  score: z.number(),
  core_value: z.string(),
  content: z.string(),
  evidence: z.array(z.string()),
  source_preview: z.string(),
})

const KTypeOutputSchema = z.object({
  executive_summary: z.string(),
  related_tags: z.array(z.string()),
  classification: z.object({
    scores: KTypeScoreSchema,
    reason: z.string(),
    type_summary: z.string(),
  }),
  scan_trace: z.object({
    dikw_level: z.string(),
    tacit_explicit_ratio: z.string(),
    logic_pattern: z.string(),
    evidence: z.array(z.string()),
  }),
  cognitive_features: z.object({
    explicit_summary: z.string(),
    tacit_summary: z.string(),
    logic_pattern_summary: z.string(),
  }),
  knowledge_modules: z.array(KTypeModuleSchema),
  distilled_content: z.string(),
})

type KTypeLLMOutput = z.infer<typeof KTypeOutputSchema>

export type KTypeProcessResult = {
  finalReport: {
    title: string
    classification: {
      scores: z.infer<typeof KTypeScoreSchema>
      dominantType: string[]
      reason: string
    }
    scanTrace: {
      dikwLevel: string
      tacitExplicitRatio: string
      logicPattern: string
      evidence: string[]
    }
    knowledgeModules: Array<{
      type: z.infer<typeof KTypeModuleType>
      score: number
      coreValue: string
      content: string
      evidence: string[]
      sourcePreview: string
    }>
    executiveSummary: string
    distilledContent: string
  }
  relatedTags: string[]
  rawOutput?: KTypeLLMOutput
}

function buildUserPrompt(text: string, _chunkInfo?: string) {
  return text
}

function wrapRawOutput(raw: string): KTypeLLMOutput {
  const content = raw.trim()
  return {
    executive_summary: '',
    related_tags: [],
    classification: {
      scores: { procedural: 0, conceptual: 0, reasoning: 0, systemic: 0, narrative: 0 },
      reason: '',
      type_summary: '',
    },
    scan_trace: {
      dikw_level: '',
      tacit_explicit_ratio: '',
      logic_pattern: '',
      evidence: [],
    },
    cognitive_features: {
      explicit_summary: '',
      tacit_summary: '',
      logic_pattern_summary: '',
    },
    knowledge_modules: [],
    distilled_content: content,
  }
}

const SAFETY_ERROR_PATTERNS = [
  /content[_\s-]?filter/i,
  /content[_\s-]?policy/i,
  /safety/i,
  /policy/i,
  /guardrail/i,
  /blocked/i,
  /refus(e|al|ed)/i,
  /violat/i,
  /moderation/i,
  /unsafe/i,
  /sensitive/i,
  /安全/,
  /审核/,
  /拦截/,
  /违规/,
  /敏感/,
  /禁止/,
  /拒绝/,
]

const SAFETY_REFUSAL_PATTERNS = [
  /抱歉/,
  /对不起/,
  /无法/,
  /不能/,
  /不便/,
  /拒绝/,
  /禁止/,
  /内容安全/,
  /安全策略/,
  /policy/i,
  /safety/i,
  /blocked/i,
  /refus(e|al|ed)/i,
  /violat/i,
  /guardrail/i,
]

const KTYPE_SECTION_MARKERS = [
  '信息型摘要',
  '结构型摘要',
  '实务型摘要',
  '评价型摘要',
  '洞察型摘要',
]

function extractErrorMessages(error: unknown): string[] {
  const messages = new Set<string>()
  const push = (value: unknown) => {
    if (value === null || value === undefined) return
    const text = String(value).trim()
    if (text) messages.add(text)
  }

  if (error instanceof Error) {
    push(error.message)
    push((error as { code?: string }).code)
    push((error as { type?: string }).type)
  }

  if (typeof error === 'object' && error) {
    const anyError = error as Record<string, any>
    push(anyError.message)
    push(anyError.code)
    push(anyError.type)
    if (anyError.error) {
      push(anyError.error.message)
      push(anyError.error.code)
      push(anyError.error.type)
    }
    if (anyError.response?.data?.error) {
      push(anyError.response.data.error.message)
      push(anyError.response.data.error.code)
      push(anyError.response.data.error.type)
    }
  } else if (typeof error === 'string') {
    push(error)
  }

  return Array.from(messages)
}

function isSafetyInterception(error: unknown): boolean {
  return extractErrorMessages(error).some((message) =>
    SAFETY_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  )
}

function looksLikeSafetyRefusal(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  const hasRefusal = SAFETY_REFUSAL_PATTERNS.some((pattern) => pattern.test(text))
  if (!hasRefusal) return false
  const markerHits = KTYPE_SECTION_MARKERS.filter((marker) => text.includes(marker)).length
  if (markerHits >= 2) return false
  return text.length < 800
}


async function callKTypeLLM(text: string, chunkInfo?: string): Promise<KTypeLLMOutput> {
  for (const profile of KTYPE_SAMPLING_PROFILES) {
    try {
      const completion = await chat({
        model: MODEL_ID,
        messages: [
          { role: 'system', content: KTYPE_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(text, chunkInfo) },
        ],
        temperature: profile.temperature,
        topP: profile.topP,
        maxTokens: 4000,
      })

      const content = completion.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('K-Type: empty response')
      }

      if (looksLikeSafetyRefusal(content)) {
        throw new KTypeSafetyError()
      }

      return wrapRawOutput(content)
    } catch (error) {
      if (error instanceof KTypeSafetyError || isSafetyInterception(error)) {
        if (profile.label === 'A') {
          console.warn(
            `[K-Type] safety block detected${chunkInfo ? ` (${chunkInfo})` : ''}, retrying with profile B (temperature=${KTYPE_SAMPLING_PROFILES[1].temperature}, top_p=${KTYPE_SAMPLING_PROFILES[1].topP}).`
          )
          continue
        }
        throw new KTypeSafetyError()
      }

      throw error
    }
  }

  throw new KTypeSafetyError()
}

function coerceLLMOutput(obj: any): KTypeLLMOutput {
  const toNum = (value: any, fallback = 5) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsedValue = Number(value)
      if (Number.isFinite(parsedValue)) return parsedValue
    }
    return fallback
  }

  const toStr = (value: any) => (value === null || value === undefined ? '' : String(value))

  const rawScores = obj?.classification?.scores
  const scores =
    rawScores && typeof rawScores === 'object'
      ? {
          procedural: toNum(rawScores.procedural),
          conceptual: toNum(rawScores.conceptual),
          reasoning: toNum(rawScores.reasoning),
          systemic: toNum(rawScores.systemic),
          narrative: toNum(rawScores.narrative),
        }
      : { procedural: 5, conceptual: 5, reasoning: 5, systemic: 5, narrative: 5 }

  const rawEvidence = obj?.scan_trace?.evidence
  const evidence = Array.isArray(rawEvidence)
    ? rawEvidence.map(toStr)
    : rawEvidence
      ? [toStr(rawEvidence)]
      : []

  const rawModules = obj?.knowledge_modules
  const modules = Array.isArray(rawModules)
    ? rawModules
    : rawModules && typeof rawModules === 'object'
      ? [rawModules]
      : []

  const normalizeModule = (module: any) => ({
    type: KTypeModuleType.options.includes(module?.type)
      ? module.type
      : 'conceptual',
    score: toNum(module?.score),
    core_value: toStr(module?.core_value),
    content: toStr(module?.content),
    evidence: Array.isArray(module?.evidence)
      ? module.evidence.map(toStr)
      : module?.evidence
        ? [toStr(module.evidence)]
        : [],
    source_preview: toStr(module?.source_preview),
  })

  const rawTags = obj?.related_tags
  const relatedTags = Array.isArray(rawTags)
    ? rawTags.map(toStr)
    : rawTags
      ? [toStr(rawTags)]
      : []

  return {
    executive_summary: toStr(obj?.executive_summary),
    related_tags: relatedTags,
    classification: {
      scores,
      reason: toStr(obj?.classification?.reason),
      type_summary: toStr(obj?.classification?.type_summary),
    },
    scan_trace: {
      dikw_level: toStr(obj?.scan_trace?.dikw_level),
      tacit_explicit_ratio: toStr(obj?.scan_trace?.tacit_explicit_ratio),
      logic_pattern: toStr(obj?.scan_trace?.logic_pattern),
      evidence,
    },
    cognitive_features: {
      explicit_summary: toStr(obj?.cognitive_features?.explicit_summary),
      tacit_summary: toStr(obj?.cognitive_features?.tacit_summary),
      logic_pattern_summary: toStr(obj?.cognitive_features?.logic_pattern_summary),
    },
    knowledge_modules: modules.map(normalizeModule),
    distilled_content: toStr(obj?.distilled_content),
  }
}

/**
 * Split full text into MAX_CONTEXT_LENGTH chunks (no head/tail truncation).
 */
function splitTextIntoChunks(text: string): { chunks: string[]; info: string } {
  if (text.length <= MAX_CONTEXT_LENGTH) {
    return {
      chunks: [text],
      info: `full text, length ${text.length.toLocaleString()} chars`,
    }
  }

  const chunks: string[] = []
  for (let i = 0; i < text.length; i += MAX_CONTEXT_LENGTH) {
    chunks.push(text.slice(i, i + MAX_CONTEXT_LENGTH))
  }

  return {
    chunks,
    info: `chunked: ${chunks.length} chunks, size ${MAX_CONTEXT_LENGTH.toLocaleString()} chars, total ${text.length.toLocaleString()} chars`,
  }
}

function parseRatio(value: string) {
  const matches = value.match(/(\d+(?:\.\d+)?)%/g)
  if (!matches || matches.length < 2) return null
  const numbers = matches.map(v => Number(v.replace('%', ''))).filter(n => Number.isFinite(n))
  if (numbers.length < 2) return null
  return { explicit: numbers[0], tacit: numbers[1] }
}

function pickMostFrequent(values: string[]) {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v || ''
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  let best = ''
  let bestCount = -1
  for (const [key, count] of counts.entries()) {
    if (!key) continue
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}

function mergeKTypeOutputs(outputs: KTypeLLMOutput[]): KTypeLLMOutput {
  if (outputs.length === 1) return outputs[0]

  const summaries = outputs.map(o => o.executive_summary).filter(Boolean)
  let executiveSummary = summaries.join(' ').replace(/\s+/g, ' ').trim()
  if (executiveSummary.length > 500) {
    executiveSummary = executiveSummary.slice(0, 500)
  }
  if (executiveSummary.length < 300 && summaries[0]) {
    executiveSummary = summaries[0]
  }

  const tagCounts = new Map<string, number>()
  const tagOrder: string[] = []
  for (const o of outputs) {
    for (const tag of o.related_tags || []) {
      const t = String(tag).trim()
      if (!t) continue
      if (!tagCounts.has(t)) tagOrder.push(t)
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }
  const relatedTags = [...tagOrder]
    .sort((a, b) => {
      const diff = (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0)
      return diff !== 0 ? diff : tagOrder.indexOf(a) - tagOrder.indexOf(b)
    })
    .slice(0, 15)

  const scoreFields = ['procedural', 'conceptual', 'reasoning', 'systemic', 'narrative'] as const
  const avgScores = scoreFields.reduce((acc, key) => {
    const sum = outputs.reduce((s, o) => s + (o.classification?.scores?.[key] ?? 0), 0)
    acc[key] = Number((sum / outputs.length).toFixed(1))
    return acc
  }, {} as Record<typeof scoreFields[number], number>)

  const reasons = outputs.map(o => o.classification?.reason).filter(Boolean)
  const typeSummaries = outputs.map(o => o.classification?.type_summary).filter(Boolean)

  const dikwLevel = pickMostFrequent(outputs.map(o => o.scan_trace?.dikw_level || '').filter(Boolean))
  const logicPattern = pickMostFrequent(outputs.map(o => o.scan_trace?.logic_pattern || '').filter(Boolean))

  const ratios = outputs
    .map(o => parseRatio(o.scan_trace?.tacit_explicit_ratio || ''))
    .filter((r): r is { explicit: number; tacit: number } => Boolean(r))
  let tacitExplicitRatio = outputs.map(o => o.scan_trace?.tacit_explicit_ratio || '').find(Boolean) || ''
  if (ratios.length) {
    const explicitAvg = ratios.reduce((s, r) => s + r.explicit, 0) / ratios.length
    const tacitAvg = ratios.reduce((s, r) => s + r.tacit, 0) / ratios.length
    tacitExplicitRatio = `${explicitAvg.toFixed(0)}%/${tacitAvg.toFixed(0)}%`
  }

  const evidenceSet = new Set<string>()
  for (const o of outputs) {
    for (const e of o.scan_trace?.evidence || []) {
      if (e) evidenceSet.add(String(e))
    }
  }
  const evidence = Array.from(evidenceSet).slice(0, 5)

  const explicitSummary = outputs
    .map(o => o.cognitive_features?.explicit_summary)
    .filter(Boolean)
    .join('\n\n')
  const tacitSummary = outputs
    .map(o => o.cognitive_features?.tacit_summary)
    .filter(Boolean)
    .join('\n\n')
  const logicPatternSummary = outputs
    .map(o => o.cognitive_features?.logic_pattern_summary)
    .filter(Boolean)
    .join('\n\n')

  const modulesByType = new Map<string, KTypeLLMOutput['knowledge_modules']>()
  for (const o of outputs) {
    for (const m of o.knowledge_modules || []) {
      if (!modulesByType.has(m.type)) modulesByType.set(m.type, [])
      modulesByType.get(m.type)!.push(m)
    }
  }

  const hasModules = outputs.some((o) => (o.knowledge_modules || []).length > 0)
  const knowledgeModules = hasModules
    ? scoreFields.map((type) => {
        const modules = modulesByType.get(type) || []
        const sorted = [...modules].sort((a, b) => (b.score || 0) - (a.score || 0))
        const top = sorted[0] || {
          type,
          score: avgScores[type],
          core_value: '',
          content: '',
          evidence: [],
          source_preview: '',
        }
        const avg = modules.length
          ? modules.reduce((s, m) => s + (m.score || 0), 0) / modules.length
          : avgScores[type]
        const coreValue =
          Array.from(new Set(modules.map((m) => m.core_value).filter(Boolean))).join(' / ') ||
          top.core_value
        const evidenceMerged = Array.from(new Set(modules.flatMap((m) => m.evidence || []).map(String))).slice(0, 5)
        return {
          type,
          score: Number(avg.toFixed(1)),
          core_value: coreValue,
          content: top.content,
          evidence: evidenceMerged.length ? evidenceMerged : top.evidence,
          source_preview: top.source_preview,
        }
      })
    : []

  const distilledContent = outputs.map(o => o.distilled_content).filter(Boolean).join('\n\n')

  return {
    executive_summary: executiveSummary,
    related_tags: relatedTags,
    classification: {
      scores: avgScores,
      reason: reasons.join('\n\n'),
      type_summary: typeSummaries.join('\n\n'),
    },
    scan_trace: {
      dikw_level: dikwLevel,
      tacit_explicit_ratio: tacitExplicitRatio,
      logic_pattern: logicPattern,
      evidence,
    },
    cognitive_features: {
      explicit_summary: explicitSummary,
      tacit_summary: tacitSummary,
      logic_pattern_summary: logicPatternSummary,
    },
    knowledge_modules: knowledgeModules,
    distilled_content: distilledContent,
  }
}

function extractDominantTypes(scores: {
  procedural: number
  conceptual: number
  reasoning: number
  systemic: number
  narrative: number
}): string[] {
  return Object.entries(scores)
    .filter(([, score]) => score > 7)
    .map(([type]) => type)
}

function normalizeOutput(obj: KTypeLLMOutput): KTypeProcessResult {
  const scores = obj.classification?.scores || {
    procedural: 5,
    conceptual: 5,
    reasoning: 5,
    systemic: 5,
    narrative: 5,
  }

  const finalReport: KTypeProcessResult['finalReport'] = {
    title: `CODE-DIKW Cognitive Scan Report (${MODEL_ID})`,
    classification: {
      scores,
      dominantType: extractDominantTypes(scores),
      reason: obj.classification?.reason || '',
    },
    scanTrace: {
      dikwLevel: obj.scan_trace?.dikw_level || '',
      tacitExplicitRatio: obj.scan_trace?.tacit_explicit_ratio || '',
      logicPattern: obj.scan_trace?.logic_pattern || '',
      evidence: obj.scan_trace?.evidence || [],
    },
    knowledgeModules: (obj.knowledge_modules || []).map((m) => ({
      type: m.type,
      score: m.score,
      coreValue: m.core_value,
      content: m.content,
      evidence: m.evidence,
      sourcePreview: m.source_preview,
    })),
    executiveSummary: obj.executive_summary || '',
    distilledContent: obj.distilled_content || '',
  }

  return {
    finalReport,
    relatedTags: obj.related_tags || [],
    rawOutput: obj,
  }
}

export async function processKTypeWorkflowEfficient(text: string): Promise<KTypeProcessResult> {
  const { chunks, info } = splitTextIntoChunks(text)

  console.log(`[K-Type] input length: ${text.length.toLocaleString()} chars`)
  console.log(`[K-Type] chunking: ${info}`)

  let result: KTypeLLMOutput
  if (chunks.length === 1) {
    result = await callKTypeLLM(chunks[0], info)
  } else {
    const outputs: KTypeLLMOutput[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunkInfo = `${info} | chunk ${i + 1}/${chunks.length}`
      outputs.push(await callKTypeLLM(chunks[i], chunkInfo))
    }
    result = mergeKTypeOutputs(outputs)
  }

  console.log(
    `[K-Type] dominant types: ${extractDominantTypes(result.classification?.scores || {}).join(', ') || 'n/a'}`
  )
  return normalizeOutput(result)
}

export async function processKTypeWorkflowEfficientWithFallback(text: string): Promise<KTypeProcessResult> {
  try {
    return await processKTypeWorkflowEfficient(text)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[K-Type] processing failed, returning simplified output:', msg)

    return {
      finalReport: {
        title: 'Simplified K-Type Report',
        classification: {
          scores: { procedural: 5, conceptual: 5, reasoning: 5, systemic: 5, narrative: 5 },
          dominantType: [],
          reason: 'LLM request failed, returning default scores.',
        },
        scanTrace: {
          dikwLevel: '',
          tacitExplicitRatio: '',
          logicPattern: '',
          evidence: [],
        },
        knowledgeModules: [],
        executiveSummary: 'K-Type processing failed; no detailed report generated.',
        distilledContent: '',
      },
      relatedTags: [],
    }
  }
}

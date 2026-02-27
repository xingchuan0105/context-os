import {
  AGENTIC_COVERAGE_THRESHOLD,
  AGENTIC_DEFAULT_MAX_ROUNDS,
  createDefaultExecutionBudget,
  shouldAppendFullOntologySummary,
  shouldStopByCoverage,
  validatePlannerState,
  type AgenticPlannerState,
} from './planner-state'
import {
  DIKW_STRATEGY_REGISTRY,
  normalizeIntentWeights,
  type DikwIntentCode,
  type DikwStrategyKey,
} from './strategy-registry'
import type {
  AgenticLoopInput,
  AgenticLoopResult,
  AgenticRetrievalInput,
  PlannerAdapterInput,
  AgenticEvidenceCard,
  PlannerAdapter,
  RetrievalAdapter,
} from './types'
import { retrieveAgenticEvidence } from './lexical-retriever'
import {
  filterDocumentIdsByNotebook,
  getDocumentById,
  getDocumentsByNotebookId,
  getDocumentsByUserId,
} from '@/lib/db/queries'
import { createLLMClientWithOverrides } from '@/lib/llm-client'
import { resolveCapabilityClientOverrides } from '@/lib/admin/model-config-resolver'
import { AGENTIC_STEP2_STATIC_BLOCK, buildStep2DynamicBlock } from './prompts'

function buildQuerySignature(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160)
}

async function resolveAutoOntologySummary(input: AgenticLoopInput): Promise<string> {
  const selectedDocIds =
    input.documentIds && input.documentIds.length > 0
      ? Array.from(new Set(input.documentIds.filter(Boolean)))
      : []

  let scopedIds = selectedDocIds
  if (input.kbId && scopedIds.length > 0) {
    scopedIds = await filterDocumentIdsByNotebook(scopedIds, input.kbId, input.userId)
  }

  const docs =
    scopedIds.length > 0
      ? (
          await Promise.all(scopedIds.map((docId) => getDocumentById(docId)))
        ).filter((doc): doc is NonNullable<typeof doc> => Boolean(doc && doc.user_id === input.userId))
      : input.kbId
        ? await getDocumentsByNotebookId(input.kbId, { limit: 24 })
        : await getDocumentsByUserId(input.userId, { limit: 24 })

  const rows = docs
    .map((doc) => {
      const summary = (doc.summary_global || doc.deep_summary || doc.ktype_summary || '').trim()
      if (!summary) return ''
      return `[Doc:${doc.file_name || doc.id}] ${summary}`
    })
    .filter(Boolean)

  return rows.join('\n\n')
}

function uniqueByChunk(cards: AgenticEvidenceCard[]): AgenticEvidenceCard[] {
  const seen = new Set<string>()
  const deduped: AgenticEvidenceCard[] = []
  for (const card of cards) {
    const key = `${card.docId}::${card.chunkId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(card)
  }
  return deduped
}

function inferIntent(query: string): DikwIntentCode {
  const q = query.toLowerCase()
  if (/(有没有|多少|最近|metadata|元数据|sources|documents)/i.test(q)) return 'M9'
  if (/(为什么|why|原因|根因)/i.test(q)) return 'K6'
  if (/(对比|比较|关系|联系|交集|intersection)/i.test(q)) return 'K5'
  if (/(总结|概览|主要观点|overview|main point|全景)/i.test(q)) return 'I3'
  if (/(时间线|演化|过程|timeline|history)/i.test(q)) return 'I4'
  if (/(建议|方案|行动|决策|怎么做|plan)/i.test(q)) return 'W8'
  return 'D1'
}

function intentToStrategy(intent: DikwIntentCode): DikwStrategyKey {
  const found = Object.values(DIKW_STRATEGY_REGISTRY).find((item) => item.intent === intent)
  return found?.key || 'pinpoint_lookup'
}

function buildHeuristicState(input: PlannerAdapterInput): AgenticPlannerState {
  const primary = inferIntent(input.userQuery)
  const weights = normalizeIntentWeights({ [primary]: 1 } as Partial<Record<DikwIntentCode, number>>)
  const strategy = intentToStrategy(primary)
  const querySignature = buildQuerySignature(input.userQuery)
  const isHighCoverage = input.evidenceCoverage >= AGENTIC_COVERAGE_THRESHOLD
  const unresolvedSlots =
    isHighCoverage || input.roundIndex > 1
      ? []
      : [{ id: 'U1', question: input.userQuery, required_for: ['T1'] }]

  return {
    intent_primary: primary,
    intent_secondary: [],
    intent_weights: weights,
    selected_strategies: [strategy],
    strategy_order: [strategy],
    execution_budget: createDefaultExecutionBudget({
      max_rounds: input.maxRounds,
      latency_tier: primary === 'M9' || primary === 'D1' ? 'fast' : 'balanced',
      cost_tier: primary === 'M9' || primary === 'D1' ? 'cheap' : 'balanced',
    }),
    summary_capsule: input.fullOntologySummary,
    sub_tasks: [
      {
        id: 'T1',
        goal: 'Answer the user query using evidence',
        depends_on: [],
        status: isHighCoverage ? 'done' : 'pending',
      },
    ],
    resolved_facts: [],
    unresolved_slots: unresolvedSlots,
    detail_gaps: unresolvedSlots.length
      ? [{ slot_id: unresolvedSlots[0].id, why_missing: 'Need evidence cards for answering.' }]
      : [],
    evidence_ledger: [],
    conflicts: [],
    query_history: input.previousState?.query_history || [],
    query_history_append: [],
    next_queries: isHighCoverage
      ? []
      : [
          {
            id: `Q${input.roundIndex}`,
            type: 'core',
            target_slot: 'U1',
            purpose: 'fill_missing_evidence',
            text: input.userQuery,
            query_signature: querySignature,
          },
        ],
    confidence: isHighCoverage ? 0.85 : 0.45,
    next_action: isHighCoverage ? 'answer' : 'retrieve_more',
  }
}

function computeEvidenceCoverage(state: AgenticPlannerState, evidenceCount: number): number {
  const resolved = state.resolved_facts.filter((item) => item.chunk_ids.length > 0).length
  const unresolved = state.unresolved_slots.length
  const denom = resolved + unresolved
  if (denom <= 0) {
    if (evidenceCount > 0) return 1
    return state.next_action === 'answer' ? 1 : 0
  }

  const slotCoverage = resolved / denom
  const evidenceBoost = Math.min(0.25, evidenceCount / 20)
  const confidenceBoost = Math.max(0, Math.min(0.2, state.confidence * 0.2))
  return Math.min(1, slotCoverage + evidenceBoost + confidenceBoost)
}

function requiresStrongRelation(query: string): boolean {
  const q = query.toLowerCase()
  return /(why|because|原因|机制|因果|导致|trigger|causal)/i.test(q)
}

function hasStrongRelationSupport(summaryCapsule: string): boolean {
  return summaryCapsule.includes('=={') || summaryCapsule.includes('>>>')
}

function mergeEvidenceIntoState(
  state: AgenticPlannerState,
  evidence: AgenticEvidenceCard[]
): AgenticPlannerState {
  if (evidence.length === 0) return state

  const evidenceLedger = [
    ...state.evidence_ledger,
    ...evidence.map((item) => ({
      chunk_id: item.chunkId,
      used_for: state.unresolved_slots.map((slot) => slot.id),
      note: `${item.source}:${item.docName}`,
    })),
  ]

  const unresolved = state.unresolved_slots
  const resolved_facts =
    unresolved.length > 0
      ? [
          ...state.resolved_facts,
          ...unresolved.map((slot, index) => ({
            id: `F_${slot.id}_${index + 1}`,
            claim: slot.question,
            chunk_ids: evidence.slice(0, 3).map((item) => item.chunkId),
            supports: slot.required_for,
          })),
        ]
      : state.resolved_facts

  return {
    ...state,
    resolved_facts,
    unresolved_slots: evidence.length > 0 ? [] : unresolved,
    detail_gaps: evidence.length > 0 ? [] : state.detail_gaps,
    evidence_ledger: evidenceLedger,
    confidence: Math.min(0.95, state.confidence + 0.2),
    next_action: evidence.length > 0 ? 'answer' : state.next_action,
  }
}

async function runPlanner(
  input: PlannerAdapterInput,
  adapter?: PlannerAdapter
): Promise<AgenticPlannerState> {
  if (!adapter) {
    try {
      const chatOverrides = resolveCapabilityClientOverrides('chat')
      const llm = createLLMClientWithOverrides('qwen_flash', {
        model: chatOverrides.model || 'qwen-flash',
        apiKey: chatOverrides.apiKey,
        baseURL: chatOverrides.baseURL,
        timeout: chatOverrides.timeout,
        defaultHeaders: chatOverrides.defaultHeaders,
      })

      const dynamicBlock = buildStep2DynamicBlock({
        roundIndex: input.roundIndex,
        maxRounds: input.maxRounds,
        userQuery: input.userQuery,
        fullOntologySummary: input.fullOntologySummary,
        previousState: input.previousState,
        evidence: input.evidence,
        evidenceCoverage: input.evidenceCoverage,
        noNewEvidenceRounds: input.noNewEvidenceRounds,
      })

      const { content } = await llm.chat(
        [
          { role: 'system', content: AGENTIC_STEP2_STATIC_BLOCK },
          { role: 'user', content: dynamicBlock },
        ],
        {
          temperature: 0,
          maxTokens: 2400,
          responseFormat: { type: 'json_object' },
        }
      )

      const parsed = JSON.parse(content)
      const validated = validatePlannerState(parsed)
      if (validated.ok && validated.state) {
        return validated.state
      }
    } catch (error) {
      console.warn(
        '[AgenticPlannerLoop] LLM planner fallback to heuristic:',
        error instanceof Error ? error.message : String(error)
      )
    }
    return buildHeuristicState(input)
  }

  const state = await adapter(input)
  const validated = validatePlannerState(state)
  if (validated.ok && validated.state) return validated.state
  return buildHeuristicState(input)
}

async function runRetrieval(
  input: AgenticRetrievalInput,
  adapter?: RetrievalAdapter
): Promise<AgenticEvidenceCard[]> {
  const cards = adapter ? await adapter(input) : await retrieveAgenticEvidence(input)
  return uniqueByChunk(cards).sort((a, b) => b.score - a.score)
}

export async function runAgenticPlannerLoop(input: AgenticLoopInput): Promise<AgenticLoopResult> {
  const fullOntologySummary =
    input.fullOntologySummary && input.fullOntologySummary.trim()
      ? input.fullOntologySummary
      : await resolveAutoOntologySummary(input)
  const maxRounds = Math.max(1, input.maxRounds ?? AGENTIC_DEFAULT_MAX_ROUNDS)
  const queryHistory = new Set<string>()
  const allEvidence: AgenticEvidenceCard[] = []
  let state: AgenticPlannerState | null = null
  let roundsUsed = 0
  let noNewEvidenceRounds = 0
  let evidenceCoverage = 0
  let dedupedQueryCount = 0
  let stopReason: AgenticLoopResult['stopReason'] = 'max_rounds'

  for (let roundIndex = 1; roundIndex <= maxRounds; roundIndex += 1) {
    roundsUsed = roundIndex
    state = await runPlanner(
      {
        roundIndex,
        userQuery: input.userQuery,
        fullOntologySummary,
        previousState: state,
        evidence: allEvidence,
        evidenceCoverage,
        noNewEvidenceRounds,
        maxRounds,
      },
      input.plannerAdapter
    )

    const uniqueQueries = []
    for (const query of state.next_queries) {
      const signature = query.query_signature?.trim() || buildQuerySignature(query.text)
      if (queryHistory.has(signature)) {
        dedupedQueryCount += 1
        continue
      }
      queryHistory.add(signature)
      uniqueQueries.push({
        ...query,
        query_signature: signature,
      })
    }

    state = {
      ...state,
      query_history: [
        ...state.query_history,
        ...uniqueQueries.map((item) => ({
          query_signature: item.query_signature,
          text: item.text,
        })),
      ],
      query_history_append: uniqueQueries.map((item) => ({
        query_signature: item.query_signature,
        text: item.text,
      })),
      next_queries: uniqueQueries,
    }

    let newEvidenceCount = 0
    for (const query of uniqueQueries.slice(0, 4)) {
      const cards = await runRetrieval(
        {
          userId: input.userId,
          kbId: input.kbId,
          documentIds: input.documentIds,
          query: query.text,
          limit: 8,
          intentPrimary: state.intent_primary,
        },
        input.retrievalAdapter
      )

      for (const card of cards) {
        if (allEvidence.some((item) => item.docId === card.docId && item.chunkId === card.chunkId))
          continue
        allEvidence.push(card)
        newEvidenceCount += 1
      }
    }

    if (newEvidenceCount === 0) {
      noNewEvidenceRounds += 1
    } else {
      noNewEvidenceRounds = 0
      state = mergeEvidenceIntoState(state, allEvidence.slice(-newEvidenceCount))
    }

    evidenceCoverage = computeEvidenceCoverage(state, allEvidence.length)

    if (shouldStopByCoverage({ nextAction: state.next_action, coverage: evidenceCoverage })) {
      stopReason = 'coverage'
      break
    }
    if (noNewEvidenceRounds >= 2) {
      stopReason = 'stagnation'
      break
    }
  }

  if (!state) {
    state = buildHeuristicState({
      roundIndex: 1,
      userQuery: input.userQuery,
      fullOntologySummary,
      previousState: null,
      evidence: [],
      evidenceCoverage: 0,
      noNewEvidenceRounds: 0,
      maxRounds,
    })
  }

  const appendFullSummary = shouldAppendFullOntologySummary({
    confidence: state.confidence,
    unresolvedSlotsCount: state.unresolved_slots.length,
    conflictsCount: state.conflicts.length,
    evidenceCoverage,
    requiresStrongRelation: requiresStrongRelation(input.userQuery),
    strongRelationSupportedByCapsule: hasStrongRelationSupport(state.summary_capsule),
  })

  return {
    state,
    evidence: allEvidence.sort((a, b) => b.score - a.score),
    evidenceCoverage,
    roundsUsed,
    stopReason,
    dedupedQueryCount,
    appendFullSummary,
    fullOntologySummary,
  }
}

export { retrieveAgenticEvidence }

import { z } from 'zod'

import {
  DIKW_INTENT_CODES,
  DIKW_STRATEGY_KEYS,
  normalizeIntentWeights,
  type DikwIntentCode,
  type DikwIntentWeights,
  type DikwStrategyKey,
} from './strategy-registry'

export const AGENTIC_COVERAGE_THRESHOLD = 0.8
export const AGENTIC_SUMMARY_BYPASS_CONFIDENCE_THRESHOLD = 0.65
export const AGENTIC_DEFAULT_MAX_ROUNDS = 6

export type RagEngineMode = 'agentic_dikw'

export function resolveRagEngineMode(raw = process.env.RAG_ENGINE): RagEngineMode {
  const value = (raw || '').trim()
  if (value === 'agentic_dikw') return 'agentic_dikw'
  return 'agentic_dikw'
}

export type LatencyTier = 'fast' | 'balanced' | 'deep'
export type CostTier = 'cheap' | 'balanced' | 'high'
export type NextAction = 'retrieve_more' | 'answer'
export type QueryType = 'core' | 'relation' | 'boundary' | 'hop'
export type QueryPurpose = 'fill_missing_evidence' | 'disambiguate' | 'challenge'

export type ExecutionBudget = {
  max_rounds: number
  latency_tier: LatencyTier
  cost_tier: CostTier
}

export type SubTask = {
  id: string
  goal: string
  depends_on: string[]
  status: 'done' | 'pending'
}

export type ResolvedFact = {
  id: string
  claim: string
  chunk_ids: string[]
  supports: string[]
}

export type UnresolvedSlot = {
  id: string
  question: string
  required_for: string[]
}

export type DetailGap = {
  slot_id: string
  why_missing: string
}

export type EvidenceLedgerItem = {
  chunk_id: string
  used_for: string[]
  note: string
}

export type ConflictItem = {
  topic: string
  chunk_ids: string[]
  note: string
}

export type QueryHistoryItem = {
  query_signature: string
  text: string
}

export type NextQuery = {
  id: string
  type: QueryType
  target_slot: string
  purpose: QueryPurpose
  text: string
  query_signature: string
}

export type AgenticPlannerState = {
  intent_primary: DikwIntentCode
  intent_secondary: DikwIntentCode[]
  intent_weights: DikwIntentWeights
  selected_strategies: DikwStrategyKey[]
  strategy_order: DikwStrategyKey[]
  execution_budget: ExecutionBudget
  summary_capsule: string
  sub_tasks: SubTask[]
  resolved_facts: ResolvedFact[]
  unresolved_slots: UnresolvedSlot[]
  detail_gaps: DetailGap[]
  evidence_ledger: EvidenceLedgerItem[]
  conflicts: ConflictItem[]
  query_history: QueryHistoryItem[]
  query_history_append: QueryHistoryItem[]
  next_queries: NextQuery[]
  confidence: number
  next_action: NextAction
}

const DikwIntentCodeSchema = z.enum(DIKW_INTENT_CODES)
const DikwStrategyKeySchema = z.enum(DIKW_STRATEGY_KEYS)

export const AgenticPlannerStateSchema: z.ZodType<AgenticPlannerState> = z.object({
  intent_primary: DikwIntentCodeSchema,
  intent_secondary: z.array(DikwIntentCodeSchema),
  intent_weights: z.record(DikwIntentCodeSchema, z.number().min(0)),
  selected_strategies: z.array(DikwStrategyKeySchema),
  strategy_order: z.array(DikwStrategyKeySchema),
  execution_budget: z.object({
    max_rounds: z.number().int().min(1).max(64),
    latency_tier: z.enum(['fast', 'balanced', 'deep']),
    cost_tier: z.enum(['cheap', 'balanced', 'high']),
  }),
  summary_capsule: z.string(),
  sub_tasks: z.array(
    z.object({
      id: z.string().min(1),
      goal: z.string().min(1),
      depends_on: z.array(z.string().min(1)),
      status: z.enum(['done', 'pending']),
    })
  ),
  resolved_facts: z.array(
    z.object({
      id: z.string().min(1),
      claim: z.string().min(1),
      chunk_ids: z.array(z.string().min(1)),
      supports: z.array(z.string().min(1)),
    })
  ),
  unresolved_slots: z.array(
    z.object({
      id: z.string().min(1),
      question: z.string().min(1),
      required_for: z.array(z.string().min(1)),
    })
  ),
  detail_gaps: z.array(
    z.object({
      slot_id: z.string().min(1),
      why_missing: z.string().min(1),
    })
  ),
  evidence_ledger: z.array(
    z.object({
      chunk_id: z.string().min(1),
      used_for: z.array(z.string().min(1)),
      note: z.string(),
    })
  ),
  conflicts: z.array(
    z.object({
      topic: z.string().min(1),
      chunk_ids: z.array(z.string().min(1)),
      note: z.string(),
    })
  ),
  query_history: z.array(
    z.object({
      query_signature: z.string().min(1),
      text: z.string().min(1),
    })
  ),
  query_history_append: z.array(
    z.object({
      query_signature: z.string().min(1),
      text: z.string().min(1),
    })
  ),
  next_queries: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['core', 'relation', 'boundary', 'hop']),
      target_slot: z.string().min(1),
      purpose: z.enum(['fill_missing_evidence', 'disambiguate', 'challenge']),
      text: z.string().min(1),
      query_signature: z.string().min(1),
    })
  ),
  confidence: z.number().min(0).max(1),
  next_action: z.enum(['retrieve_more', 'answer']),
})

export function createDefaultExecutionBudget(
  overrides?: Partial<ExecutionBudget>
): ExecutionBudget {
  return {
    max_rounds: overrides?.max_rounds ?? AGENTIC_DEFAULT_MAX_ROUNDS,
    latency_tier: overrides?.latency_tier ?? 'balanced',
    cost_tier: overrides?.cost_tier ?? 'balanced',
  }
}

export function shouldStopByCoverage(params: {
  nextAction: NextAction
  coverage: number
  threshold?: number
}): boolean {
  if (params.nextAction !== 'answer') return false
  const threshold = params.threshold ?? AGENTIC_COVERAGE_THRESHOLD
  return params.coverage >= threshold
}

export function shouldAppendFullOntologySummary(params: {
  confidence: number
  unresolvedSlotsCount: number
  conflictsCount: number
  evidenceCoverage: number
  requiresStrongRelation: boolean
  strongRelationSupportedByCapsule: boolean
}): boolean {
  if (params.confidence < AGENTIC_SUMMARY_BYPASS_CONFIDENCE_THRESHOLD) return true
  if (params.unresolvedSlotsCount > 0) return true
  if (params.conflictsCount > 0) return true
  if (params.evidenceCoverage < AGENTIC_COVERAGE_THRESHOLD) return true
  if (params.requiresStrongRelation && !params.strongRelationSupportedByCapsule) return true
  return false
}

export function validatePlannerState(input: unknown): {
  ok: boolean
  state?: AgenticPlannerState
  errors?: string[]
} {
  const parsed = AgenticPlannerStateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    }
  }

  const state = parsed.data
  return {
    ok: true,
    state: {
      ...state,
      intent_weights: normalizeIntentWeights(state.intent_weights),
      execution_budget: createDefaultExecutionBudget(state.execution_budget),
    },
  }
}

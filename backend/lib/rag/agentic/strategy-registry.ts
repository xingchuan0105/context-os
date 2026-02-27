export const DIKW_INTENT_CODES = [
  'D1',
  'D2',
  'I3',
  'I4',
  'K5',
  'K6',
  'W7',
  'W8',
  'M9',
] as const

export type DikwIntentCode = (typeof DIKW_INTENT_CODES)[number]

export const DIKW_STRATEGY_KEYS = [
  'pinpoint_lookup',
  'filter_collect',
  'global_synthesis',
  'chronological_chaining',
  'multi_anchor_collision',
  'backward_chaining',
  'abstract_random_walk',
  'constrained_projection',
  'meta_db_routing',
] as const

export type DikwStrategyKey = (typeof DIKW_STRATEGY_KEYS)[number]

export type StrategyRealizationMode = 'native' | 'parameter_composed'

export type DikwStrategyDefinition = {
  key: DikwStrategyKey
  intent: DikwIntentCode
  realizationMode: StrategyRealizationMode
  description: string
}

export const DIKW_STRATEGY_REGISTRY: Record<DikwStrategyKey, DikwStrategyDefinition> = {
  pinpoint_lookup: {
    key: 'pinpoint_lookup',
    intent: 'D1',
    realizationMode: 'native',
    description: 'Exact entity/event lookup with narrow retrieval scope.',
  },
  filter_collect: {
    key: 'filter_collect',
    intent: 'D2',
    realizationMode: 'native',
    description: 'Breadth-first filtered collection for aggregation/list outputs.',
  },
  global_synthesis: {
    key: 'global_synthesis',
    intent: 'I3',
    realizationMode: 'parameter_composed',
    description: 'Summary-first synthesis with targeted detail supplementation.',
  },
  chronological_chaining: {
    key: 'chronological_chaining',
    intent: 'I4',
    realizationMode: 'native',
    description: 'Timeline-ordered retrieval and sequence reconstruction.',
  },
  multi_anchor_collision: {
    key: 'multi_anchor_collision',
    intent: 'K5',
    realizationMode: 'parameter_composed',
    description: 'Parallel anchor retrieval with intersection and bridge finding.',
  },
  backward_chaining: {
    key: 'backward_chaining',
    intent: 'K6',
    realizationMode: 'native',
    description: 'Target-first causal backtracking with dependency slots.',
  },
  abstract_random_walk: {
    key: 'abstract_random_walk',
    intent: 'W7',
    realizationMode: 'parameter_composed',
    description: 'Cross-domain abstraction exploration with bounded hops.',
  },
  constrained_projection: {
    key: 'constrained_projection',
    intent: 'W8',
    realizationMode: 'parameter_composed',
    description: 'Constraint-aware projection from principles to actionable plans.',
  },
  meta_db_routing: {
    key: 'meta_db_routing',
    intent: 'M9',
    realizationMode: 'native',
    description: 'Metadata-only routing for system-level queries.',
  },
}

export type DikwIntentWeights = Record<DikwIntentCode, number>

export function normalizeIntentWeights(
  raw: Partial<Record<DikwIntentCode, number>>
): DikwIntentWeights {
  const normalized = {} as DikwIntentWeights
  let total = 0

  for (const code of DIKW_INTENT_CODES) {
    const value = Number(raw[code] ?? 0)
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    normalized[code] = safe
    total += safe
  }

  if (total <= 0) {
    const fallback = 1 / DIKW_INTENT_CODES.length
    for (const code of DIKW_INTENT_CODES) {
      normalized[code] = fallback
    }
    return normalized
  }

  for (const code of DIKW_INTENT_CODES) {
    normalized[code] = normalized[code] / total
  }

  return normalized
}


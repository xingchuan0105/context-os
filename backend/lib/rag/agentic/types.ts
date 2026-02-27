import type { AgenticPlannerState } from './planner-state'
import type { DikwIntentCode } from './strategy-registry'

export type AgenticEvidenceSource = 'summary' | 'content' | 'meta'

export interface AgenticEvidenceCard {
  chunkId: string
  docId: string
  docName: string
  content: string
  score: number
  source: AgenticEvidenceSource
  metadata?: Record<string, unknown>
}

export interface AgenticRetrievalInput {
  userId: string
  kbId?: string
  documentIds?: string[]
  query: string
  limit?: number
  intentPrimary?: DikwIntentCode
}

export interface AgenticLoopInput {
  userId: string
  userQuery: string
  fullOntologySummary: string
  kbId?: string
  documentIds?: string[]
  maxRounds?: number
  plannerAdapter?: PlannerAdapter
  retrievalAdapter?: RetrievalAdapter
}

export type PlannerAdapter = (input: PlannerAdapterInput) => Promise<AgenticPlannerState>

export type RetrievalAdapter = (input: AgenticRetrievalInput) => Promise<AgenticEvidenceCard[]>

export interface PlannerAdapterInput {
  roundIndex: number
  userQuery: string
  fullOntologySummary: string
  previousState: AgenticPlannerState | null
  evidence: AgenticEvidenceCard[]
  evidenceCoverage: number
  noNewEvidenceRounds: number
  maxRounds: number
}

export type AgenticLoopStopReason = 'coverage' | 'stagnation' | 'max_rounds'

export interface AgenticLoopResult {
  state: AgenticPlannerState
  evidence: AgenticEvidenceCard[]
  evidenceCoverage: number
  roundsUsed: number
  stopReason: AgenticLoopStopReason
  dedupedQueryCount: number
  appendFullSummary: boolean
  fullOntologySummary: string
}

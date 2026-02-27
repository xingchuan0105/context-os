import type { AgenticPlannerState } from './planner-state'
import type { AgenticEvidenceCard } from './types'

export const AGENTIC_STEP2_STATIC_BLOCK = `# Role
You are the planner in an AgenticRAG loop. Your output MUST be strict JSON.

# Symbol System (must understand)
- := definition
- =={X}==> strong causality
- --{X}--> weak causality / policy intent
- >>> threshold trigger
- :: dialectic note / side-effect
- [Tag] attribute tag

# Hard Rules
1. Use only evidence-supported relations from the provided ontology summary and evidence cards.
2. Do not invent entities or strong relations without support.
3. Prefer retrieval over guessing when evidence is insufficient.
4. Maintain MECE intent routing (DIKW + Meta).
5. Output JSON only, no markdown, no prose.

# JSON Contract
{
  "intent_primary": "D1|D2|I3|I4|K5|K6|W7|W8|M9",
  "intent_secondary": ["..."],
  "intent_weights": {"D1":0,"D2":0,"I3":0,"I4":0,"K5":0,"K6":0,"W7":0,"W8":0,"M9":0},
  "selected_strategies": ["pinpoint_lookup|filter_collect|global_synthesis|chronological_chaining|multi_anchor_collision|backward_chaining|abstract_random_walk|constrained_projection|meta_db_routing"],
  "strategy_order": ["..."],
  "execution_budget": {"max_rounds": 1, "latency_tier": "fast|balanced|deep", "cost_tier": "cheap|balanced|high"},
  "summary_capsule": "string",
  "sub_tasks": [{"id":"T1","goal":"string","depends_on":[],"status":"done|pending"}],
  "resolved_facts": [{"id":"F1","claim":"string","chunk_ids":["chunk"],"supports":["T1"]}],
  "unresolved_slots": [{"id":"U1","question":"string","required_for":["T1"]}],
  "detail_gaps": [{"slot_id":"U1","why_missing":"string"}],
  "evidence_ledger": [{"chunk_id":"chunk","used_for":["T1"],"note":"string"}],
  "conflicts": [{"topic":"string","chunk_ids":["chunk"],"note":"string"}],
  "query_history": [{"query_signature":"sig","text":"query"}],
  "query_history_append": [{"query_signature":"sig","text":"query"}],
  "next_queries": [{"id":"Q1","type":"core|relation|boundary|hop","target_slot":"U1","purpose":"fill_missing_evidence|disambiguate|challenge","text":"query text","query_signature":"sig"}],
  "confidence": 0.0,
  "next_action": "retrieve_more|answer"
}`

export function buildStep2DynamicBlock(input: {
  roundIndex: number
  maxRounds: number
  userQuery: string
  fullOntologySummary: string
  previousState: AgenticPlannerState | null
  evidence: AgenticEvidenceCard[]
  evidenceCoverage: number
  noNewEvidenceRounds: number
}): string {
  const evidenceText =
    input.evidence.length > 0
      ? input.evidence
          .slice(0, 24)
          .map(
            (item) =>
              `- [${item.chunkId}] (${item.docName}, score=${item.score.toFixed(3)}, source=${item.source}) ${item.content}`
          )
          .join('\n')
      : '(none)'

  return [
    `round_index: ${input.roundIndex}/${input.maxRounds}`,
    `evidence_coverage: ${input.evidenceCoverage.toFixed(3)}`,
    `no_new_evidence_rounds: ${input.noNewEvidenceRounds}`,
    '',
    '[USER_QUERY]',
    input.userQuery,
    '',
    '[ONTOLOGY_SUMMARY]',
    input.fullOntologySummary || '(none)',
    '',
    '[PREVIOUS_STATE_JSON]',
    input.previousState ? JSON.stringify(input.previousState) : '(null)',
    '',
    '[EVIDENCE_CARDS]',
    evidenceText,
  ].join('\n')
}

const STEP3_PROMPT_TEMPLATE = `# Role
你是一个基于“语境锚定与证据填充”策略的专家级知识问答引擎。你的任务是根据提供的【全局摘要】和【检索片段】回答问题。

# Symbol System (符号语义)
- := 定义关系（Definition）
- =={X}==> 强因果/必然机制（Strong Causality）
- --{X}--> 弱因果/倾向/策略意图（Weak Causality）
- >>> 临界触发（Threshold Trigger）
- :: 辩证备注/副作用/限定条件（Dialectic Note）
- [Tag] 属性标签（如 Negative / Strategy / Risk）

# Strategy: Scaffolding & Filling
1. 构建脚手架（Scaffolding）:
   - 先阅读【全局摘要】并建立宏观语境与意图边界。
   - 回答开头必须给出先行组织者。
2. 排列中间包（Archipelago of Ideas）:
   - 把【检索片段】视作逻辑路标，筛选并排序形成证据链。
3. 编织与互证（Interanimation）:
   - 先宏观（Zoom Out）后微观（Zoom In），确保观点与证据对齐。
   - 若存在摘要未覆盖的特例，明确标注细微差别。

# Inputs
## User Query
{{user_query}}

## Global Document Summary (The Scaffold)
{{global_summary}}

## Retrieved Context Chunks (The Evidence)
{{retrieved_chunks}}

# Constraints
1. 真实性原则：若输入不足，必须明确“证据不足”。
2. 结构优先：必须体现“观点（摘要）+证据（片段）”。
3. 关系门控：若摘要无支撑，禁止新增强关系结论。
4. 引用规范：关键结论句尾必须带 [[ID]]，可多引 [[1]][[2]]。
5. 禁止伪造引用 ID。

# Output Format
1. 核心立场 (The Anchor)
2. 详细阐述 (The Bridge & Evidence)
3. 综合结论 (Synthesis)

请开始执行回答：`

export function buildStep3AnswerSystemPrompt(input: {
  userQuery: string
  globalSummary: string
  retrievedChunks: string
}): string {
  return STEP3_PROMPT_TEMPLATE
    .split('{{user_query}}')
    .join(input.userQuery)
    .split('{{global_summary}}')
    .join(input.globalSummary || '(none)')
    .split('{{retrieved_chunks}}')
    .join(input.retrievedChunks || '(none)')
}

export function formatEvidenceCardsForPrompt(cards: AgenticEvidenceCard[]): string {
  if (cards.length === 0) return '（无）'

  return cards
    .map((card, index) => {
      const id = index + 1
      return `[ID: ${id}] chunk_id=${card.chunkId} (doc: ${card.docName}, source: ${card.source}, score: ${card.score.toFixed(3)}) ${card.content}`
    })
    .join('\n')
}


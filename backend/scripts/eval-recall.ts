import 'dotenv/config'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { initializeDatabase, db } from '../lib/db/schema'
import { ragRetrieve, type RAGResult } from '../lib/rag/retrieval'
import { getDocumentsByKbId } from '../lib/db/queries'
import { createLLMClient } from '../lib/llm-client'

type TestCase = { id: string; query: string }

const TEST_SET_PATH = resolve(process.cwd(), '测试集.json')
const REPORT_PATH = resolve(process.cwd(), 'recall-report.json')
const USER_EMAIL = 'auto-rag@example.com'
const KB_TITLE = 'Auto RAG KB'
const REFLECTION_THRESHOLD = 0.3
const REFLECTION_LOOPS = 2
const TOPK_CHILD = 5

async function selectDocsBySummary(query: string, kbId: string, limit = 3): Promise<string[]> {
  const docs = await getDocumentsByKbId(kbId)
  if (docs.length === 0) return []

  const listText = docs
    .map(
      (d, idx) =>
        `${idx + 1}. doc_id=${d.id}\n   file=${d.file_name}\n   summary=${(d.ktype_summary || d.deep_summary || '').slice(0, 500) || 'n/a'}`,
    )
    .join('\n')

  try {
    const llm = createLLMClient('qwen_flash')
    const { content } = await llm.chat(
      [
        {
          role: 'system',
          content:
            '你是检索路由器，给定查询和文档执行摘要，返回最相关 doc_id 列表，JSON 输出：{"doc_ids":["id1","id2"]}，不要输出其他内容。',
        },
        {
          role: 'user',
          content: `查询：${query}\n最多返回${limit} 个文档。\n候选文档：\n${listText}`,
        },
      ],
      { temperature: 0, responseFormat: { type: 'json_object' } },
    )
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    const ids = (parsed.doc_ids || parsed.docIds || parsed.documents) as string[] | undefined
    if (Array.isArray(ids)) return ids.filter((id) => typeof id === 'string' && id.trim().length > 0).slice(0, limit)
  } catch (err) {
    console.warn(`[DocRouting] 失败，fallback: ${err instanceof Error ? err.message : String(err)}`)
  }

  const terms = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean)
  return docs
    .map((d) => {
      const summary = (d.ktype_summary || d.deep_summary || '').toLowerCase()
      const score = terms.reduce((acc, t) => (summary.includes(t) ? acc + 1 : acc), 0)
      return { id: d.id, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((d) => d.id)
}

function loadTestSet(): TestCase[] {
  const raw = readFileSync(TEST_SET_PATH, 'utf-8')
  const tests: TestCase[] = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\s+(.*\S)\s*$/)
    if (m) {
      const num = parseInt(m[1], 10)
      const id = `q_${String(num).padStart(3, '0')}`
      const query = m[2].trim()
      tests.push({ id, query })
    }
  }
  if (tests.length === 0) {
    throw new Error('测试集解析失败：未找到任何“编号. 问题”行')
  }
  return tests
}

function ensureUserKb() {
  initializeDatabase()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(USER_EMAIL) as any
  if (!user) throw new Error('找不到测试用户，请先运行 ingest 流程')
  const kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(user.id, KB_TITLE) as any
  if (!kb) throw new Error('找不到测试知识库，请先运行 ingest 流程')
  return { user, kb }
}

function getTopScore(r: RAGResult): number {
  const scores: number[] = []
  if (r.context.document?.score) scores.push(r.context.document.score)
  r.context.parents.forEach((p) => scores.push(p.score))
  r.context.children.forEach((c) => scores.push(c.score))
  return scores.length ? Math.max(...scores) : 0
}

async function rewriteQuery(query: string): Promise<string> {
  const llm = createLLMClient('qwen_flash')
  const prompt = `当前检索得分偏低，请改写查询，使其更易命中资料：
- 若问题过于抽象，请具体化（补充场景、对象、关键名词）
- 若问题过于细碎，请稍作抽象，保留核心主题
- 保留中文，输出 JSON：{"query": "..."}`
  try {
    const { content } = await llm.chat(
      [
        { role: 'system', content: '你是检索查询改写器，只能输出 JSON。' },
        { role: 'user', content: `原查询：${query}\n${prompt}` },
      ],
      { temperature: 0, responseFormat: { type: 'json_object' } },
    )
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    const q = parsed.query || parsed.new_query || parsed.rewritten_query
    if (typeof q === 'string' && q.trim()) return q.trim()
  } catch (err) {
    console.warn('[Rewrite] 失败，沿用原查询:', err instanceof Error ? err.message : String(err))
  }
  return query
}

async function generateAnswer(query: string, result: RAGResult): Promise<string> {
  const llm = createLLMClient('deepseek_v32')
  const docText = result.context.document?.payload?.content || ''

  const topChildren = [...result.context.children]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOPK_CHILD)
    .map((c, idx) => `子块${idx + 1} (score=${c.score.toFixed(3)}): ${c.payload?.content || ''}`)
  const parents = result.context.parents
    .map((p, idx) => `父块${idx + 1} (score=${p.score.toFixed(3)}): ${p.payload?.content || ''}`)
    .join('\n\n')
  const childText = topChildren.join('\n\n')

  const messages = [
    {
      role: 'system' as const,
      content:
        '你是严谨的问答助手，必须严格依赖提供的上下文作答，不要编造。如果上下文不足，请直说“未找到相关信息”。保持中文作答。',
    },
    {
      role: 'user' as const,
      content: `问题：${query}
文档层 KType 报告：${docText}
相关父块：
${parents}

Top${TOPK_CHILD} 子块：
${childText}

请基于以上上下文作答，引用到的要点用简短说明，不要臆造。`,
    },
  ]

  try {
    const { content } = await llm.chat(messages, { temperature: 0.2, maxTokens: 800 })
    return content
  } catch (err) {
    console.warn('[生成回答] 失败，返回空答案:', err instanceof Error ? err.message : String(err))
    return ''
  }
}

function gradeWithLLM(query: string, answer: string) {
  const llm = createLLMClient('qwen_flash')
  const prompt = `你是严格的评分员，请根据以下标准对系统回答进行评分（1-5 分，5 为最好），并仅输出 JSON：
维度：
1) Comprehensiveness：是否覆盖问题关键点/细节，是否充分利用语料知识。
2) Diversity：是否多角度（技术/行为/长远影响等）给出见解，是否体现跨层级分析。
3) Empowerment：是否帮助读者理解复杂系统逻辑，是否给出可执行的指引。
4) Overall：综合前三项，考虑逻辑连贯、准确性、表述质量。

输出格式：
{
  "Comprehensiveness": { "Score": 0, "Reason": "..." },
  "Diversity": { "Score": 0, "Reason": "..." },
  "Empowerment": { "Score": 0, "Reason": "..." },
  "Overall": { "Score": 0, "Reason": "..." }
}

待评估问题：${query}
系统回答：${answer.slice(0, 4000)}`

  return llm
    .chat(
      [
        { role: 'system', content: '你是严谨的评分员，只能按要求输出 JSON。' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0, responseFormat: { type: 'json_object' } },
    )
    .then(({ content }) => {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
      return JSON.parse(cleaned)
    })
    .catch((err) => {
      console.warn('[LLM评分] 失败，返回空评分：', err instanceof Error ? err.message : String(err))
      return {
        Comprehensiveness: { Score: 0, Reason: 'LLM 评分失败' },
        Diversity: { Score: 0, Reason: 'LLM 评分失败' },
        Empowerment: { Score: 0, Reason: 'LLM 评分失败' },
        Overall: { Score: 0, Reason: 'LLM 评分失败' },
      }
    })
}

async function main() {
  const { user, kb } = ensureUserKb()
  const tests = loadTestSet()
  const metrics: Array<any> = []

  for (const t of tests) {
    let queryCurrent = t.query
    let docIds: string[] = []
    let result: RAGResult | null = null

    for (let i = 0; i <= REFLECTION_LOOPS; i++) {
      docIds = await selectDocsBySummary(queryCurrent, kb.id, 3)
      result = await ragRetrieve(user.id, queryCurrent, {
        kbId: kb.id,
        documentIds: docIds,
        documentLimit: 5,
        parentLimit: 10,
        childLimit: 16,
        scoreThreshold: 0.3,
        rerank: true, // parent/child rerank on
      })
      const topScore = getTopScore(result)
      if (topScore < REFLECTION_THRESHOLD && i < REFLECTION_LOOPS) {
        queryCurrent = await rewriteQuery(queryCurrent)
        continue
      }
      break
    }

    if (!result) {
      console.warn(`[Case ${t.id}] 未获取到检索结果，跳过`)
      continue
    }

    const answer = await generateAnswer(queryCurrent, result)
    const scores = await gradeWithLLM(queryCurrent, answer)

    metrics.push({ id: t.id, query_original: t.query, query_used: queryCurrent, docIds, answer, scores })
    console.log(`🔍 ${t.id} done`)
    await new Promise((res) => setTimeout(res, 200))
  }

  const report = { total: metrics.length, cases: metrics }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')
  console.log('\n✅ 评分完成，报告已写入', REPORT_PATH)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

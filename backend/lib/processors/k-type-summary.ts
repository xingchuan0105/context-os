/**
 * K-Type 摘要生成器
 *
 * 将 K-Type 分析结果转为适合向量搜索的自然语言摘要
 */

import type { KTypeProcessResult } from './k-type'

/**
 * 认知类型中文映射
 */
const TYPE_LABELS: Record<string, string> = {
  procedural: 'Procedure(操作步骤)',
  conceptual: 'Theory(概念原理)',
  reasoning: 'Reasoning(推理分析)',
  systemic: 'System(系统架构)',
  narrative: 'Narrative(叙事描述)',
}

/**
 * 从 K-Type 分析结果生成向量搜索摘要
 *
 * 设计原则:
 * 1. 摘要应该是自然语言形式，适合嵌入
 * 2. 包含关键信息：主导类型、核心模块、适用场景
 * 3. 结构化但易读，便于 RAG 检索和 LLM 理解
 */
export function buildKTypeSummaryText(result: KTypeProcessResult): string {
  const { finalReport } = result
  return (finalReport.distilledContent || finalReport.executiveSummary || '').trim()
}

/**
 * 生成简短摘要（用于显示）
 */
export function buildKTypeShortSummary(result: KTypeProcessResult): string {
  const summary = (result.finalReport.distilledContent || result.finalReport.executiveSummary || '')
    .replace(/\s+/g, ' ')
    .trim()
  return summary.slice(0, 120)
}

/**
 * 生成结构化元数据（用于过滤和展示）
 */
export function buildKTypeMetadata(result: KTypeProcessResult) {
  const { finalReport } = result

  // 找出主导类型（单个）
  const scores = finalReport.classification.scores
  const dominantType = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0][0]

  // 提取所有知识模块名称
  const knowledgeModules = finalReport.knowledgeModules
    .filter(m => m.score >= 5)
    .map(m => m.coreValue)

  return {
    dominant_type: dominantType,
    dominant_types: finalReport.classification.dominantType,
    type_scores: scores,
    knowledge_modules: knowledgeModules,
    dikw_level: finalReport.scanTrace.dikwLevel,
    logic_pattern: finalReport.scanTrace.logicPattern,
  }
}

/**
 * 从 K-Type 结果提取关键词（用于辅助检索）
 */
export function extractKTypeKeywords(result: KTypeProcessResult): string[] {
  const keywords: string[] = []

  // 添加类型关键词
  keywords.push(...result.finalReport.classification.dominantType)

  // 从知识模块中提取关键词
  for (const module of result.finalReport.knowledgeModules) {
    if (module.score >= 6) {
      // 从 core_value 中提取关键词
      const words = module.coreValue
        .split(/[，、；：,;\s]/)
        .filter(w => w.length >= 2 && w.length <= 10)
      keywords.push(...words.slice(0, 3))
    }
  }

  return [...new Set(keywords)]
}

// 导出类型
export type KTypeSummaryMetadata = ReturnType<typeof buildKTypeMetadata>

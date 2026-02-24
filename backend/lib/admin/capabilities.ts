export const MODEL_CAPABILITIES = [
  'chat',
  'ktype',
  'embedding',
  'rerank',
  'ocr',
  'query_rewrite',
  'doc_routing',
  'quicknote_summary',
  'quicknote_label',
  'quicknote_chat',
  'web_parse_firecrawl',
  'legacy_oneapi',
] as const

export type ModelCapability = (typeof MODEL_CAPABILITIES)[number]

export type ProviderMode = 'litellm' | 'direct' | 'legacy_oneapi'

export type CapabilityModelCategory = 'llm' | 'ocr_vl' | 'embedding' | 'rerank' | 'none'

export type CapabilityMeta = {
  capability: ModelCapability
  label: string
  description: string
  supportsModel: boolean
  supportsTimeout: boolean
  supportsPrompt: boolean
  defaultProviderMode: ProviderMode
  litellmOnly: boolean
  modelCategory: CapabilityModelCategory
}

export const CAPABILITY_META: Record<ModelCapability, CapabilityMeta> = {
  chat: {
    capability: 'chat',
    label: 'Chat 对话',
    description: '主对话与消息生成能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  ktype: {
    capability: 'ktype',
    label: 'K-Type 解析',
    description: '文档 K-Type 认知分析能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  embedding: {
    capability: 'embedding',
    label: 'Embedding 向量化',
    description: '文档与查询向量嵌入',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'embedding',
  },
  rerank: {
    capability: 'rerank',
    label: 'Rerank 重排',
    description: '检索结果重排序',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'rerank',
  },
  ocr: {
    capability: 'ocr',
    label: 'OCR 视觉解析',
    description: '图片/PDF 视觉 OCR 解析',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: true,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'ocr_vl',
  },
  query_rewrite: {
    capability: 'query_rewrite',
    label: 'Query Rewrite',
    description: '检索查询改写',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  doc_routing: {
    capability: 'doc_routing',
    label: 'Doc Routing',
    description: '候选文档路由选择',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  quicknote_summary: {
    capability: 'quicknote_summary',
    label: 'QuickNote Summary',
    description: '快速笔记总结能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  quicknote_label: {
    capability: 'quicknote_label',
    label: 'QuickNote Label',
    description: '快速笔记标签能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  quicknote_chat: {
    capability: 'quicknote_chat',
    label: 'QuickNote Chat',
    description: '快速笔记对话能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
  web_parse_firecrawl: {
    capability: 'web_parse_firecrawl',
    label: 'Firecrawl 网页解析',
    description: '网页抓取与解析（Firecrawl）',
    supportsModel: false,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'direct',
    litellmOnly: false,
    modelCategory: 'none',
  },
  legacy_oneapi: {
    capability: 'legacy_oneapi',
    label: 'OneAPI 兼容',
    description: '历史 OneAPI 兼容能力',
    supportsModel: true,
    supportsTimeout: true,
    supportsPrompt: false,
    defaultProviderMode: 'litellm',
    litellmOnly: true,
    modelCategory: 'llm',
  },
}

export function isModelCapability(value: unknown): value is ModelCapability {
  return typeof value === 'string' && (MODEL_CAPABILITIES as readonly string[]).includes(value)
}

export function isLiteLLMOnlyCapability(capability: ModelCapability): boolean {
  return CAPABILITY_META[capability].litellmOnly
}

export function isLiteLLMEnforcementEnabled(): boolean {
  return process.env.ADMIN_FORCE_LITELLM_ONLY !== 'false'
}

export function isLiteLLMEnforcedCapability(capability: ModelCapability): boolean {
  return isLiteLLMEnforcementEnabled() && isLiteLLMOnlyCapability(capability)
}

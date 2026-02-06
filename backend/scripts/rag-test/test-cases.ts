/**
 * RAG 召回自动化测试用例
 * 基于 ContextOS 系统的真实内容
 */

export interface TestCase {
  id: string
  query: string
  category: 'factual' | 'conceptual' | 'procedural' | 'comparative' | 'complex' | 'boundary' | 'multi-doc'
  difficulty: 'easy' | 'medium' | 'hard' | 'challenge'
  description: string
  expected?: {
    minResults: number
    expectedKeywords: string[]
    expectedDocTypes?: string[]
    relevantLayers?: ('document' | 'parent' | 'child')[]
  }
}

/**
 * 完整的测试用例集
 */
export const TEST_CASES: TestCase[] = [
  // ==================== 事实性查询 ====================
  {
    id: 'F1',
    query: 'ContextOS 支持哪些文件格式？',
    category: 'factual',
    difficulty: 'easy',
    description: '查询系统支持的文件类型',
    expected: {
      minResults: 2,
      expectedKeywords: ['pdf', 'docx', 'txt', 'md'],
      relevantLayers: ['document', 'child'],
    },
  },
  {
    id: 'F2',
    query: 'BAAI/bge-m3 模型的向量维度是多少？',
    category: 'factual',
    difficulty: 'easy',
    description: '查询技术参数',
    expected: {
      minResults: 1,
      expectedKeywords: ['1024', '维度', 'vector'],
      relevantLayers: ['child'],
    },
  },
  {
    id: 'F3',
    query: 'Qdrant 默认的端口是什么？',
    category: 'factual',
    difficulty: 'easy',
    description: '查询配置参数',
    expected: {
      minResults: 1,
      expectedKeywords: ['6333', 'port', '端口'],
      relevantLayers: ['child'],
    },
  },
  {
    id: 'F4',
    query: '向量检索使用的距离度量是什么？',
    category: 'factual',
    difficulty: 'easy',
    description: '查询算法配置',
    expected: {
      minResults: 1,
      expectedKeywords: ['cosine', '余弦', '距离'],
      relevantLayers: ['child', 'parent'],
    },
  },
  {
    id: 'F5',
    query: 'KTYPE 分析有哪几个维度？',
    category: 'factual',
    difficulty: 'medium',
    description: '查询KTYPE分类维度',
    expected: {
      minResults: 2,
      expectedKeywords: ['dominantType', 'knowledgeModules', 'dikwLevel', 'logicPattern'],
      relevantLayers: ['document', 'parent'],
    },
  },

  // ==================== 概念性查询 ====================
  {
    id: 'C1',
    query: '什么是 KTYPE 认知分析？',
    category: 'conceptual',
    difficulty: 'easy',
    description: '查询KTYPE定义',
    expected: {
      minResults: 2,
      expectedKeywords: ['认知分析', '摘要', '分类', '知识类型'],
      relevantLayers: ['document', 'parent'],
    },
  },
  {
    id: 'C2',
    query: '什么是父子分块策略？',
    category: 'conceptual',
    difficulty: 'easy',
    description: '查询分块策略定义',
    expected: {
      minResults: 2,
      expectedKeywords: ['父块', '子块', '分块', 'chunk'],
      relevantLayers: ['document', 'parent'],
    },
  },
  {
    id: 'C3',
    query: '什么是三层RAG检索架构？',
    category: 'conceptual',
    difficulty: 'medium',
    description: '查询三层架构概念',
    expected: {
      minResults: 2,
      expectedKeywords: ['document', 'parent', 'child', '文档层', '父块层', '子块层'],
      relevantLayers: ['document', 'parent'],
    },
  },
  {
    id: 'C4',
    query: '向量数据库和关系数据库有什么区别？',
    category: 'conceptual',
    difficulty: 'medium',
    description: '查询数据库对比',
    expected: {
      minResults: 1,
      expectedKeywords: ['向量', '相似度', '语义检索', 'SQL'],
      relevantLayers: ['parent', 'child'],
    },
  },
  {
    id: 'C5',
    query: 'executiveSummary 是什么？',
    category: 'conceptual',
    difficulty: 'easy',
    description: '查询KTYPE摘要概念',
    expected: {
      minResults: 1,
      expectedKeywords: ['摘要', 'summary', '概述'],
      relevantLayers: ['document'],
    },
  },

  // ==================== 程序性查询 ====================
  {
    id: 'P1',
    query: '如何上传文档到知识库？',
    category: 'procedural',
    difficulty: 'easy',
    description: '查询文档上传步骤',
    expected: {
      minResults: 2,
      expectedKeywords: ['上传', 'upload', '选择文件', '创建知识库'],
      relevantLayers: ['child', 'parent'],
    },
  },
  {
    id: 'P2',
    query: '如何配置 Qdrant 向量数据库？',
    category: 'procedural',
    difficulty: 'medium',
    description: '查询Qdrant配置步骤',
    expected: {
      minResults: 2,
      expectedKeywords: ['QDRANT_URL', '环境变量', '配置', '端口'],
      relevantLayers: ['parent', 'child'],
    },
  },
  {
    id: 'P3',
    query: '如何创建一个新的知识库？',
    category: 'procedural',
    difficulty: 'easy',
    description: '查询创建知识库步骤',
    expected: {
      minResults: 2,
      expectedKeywords: ['创建', '知识库', '知识库管理', 'KB'],
      relevantLayers: ['child'],
    },
  },
  {
    id: 'P4',
    query: '文档上传失败怎么处理？',
    category: 'procedural',
    difficulty: 'medium',
    description: '查询故障排查',
    expected: {
      minResults: 1,
      expectedKeywords: ['失败', '错误', '重试', '日志'],
      relevantLayers: ['child'],
    },
  },
  {
    id: 'P5',
    query: '如何使用选中文档功能进行对话？',
    category: 'procedural',
    difficulty: 'medium',
    description: '查询文档筛选对话功能',
    expected: {
      minResults: 1,
      expectedKeywords: ['选中', '勾选', '文档源', '检索'],
      relevantLayers: ['child', 'parent'],
    },
  },

  // ==================== 比较性查询 ====================
  {
    id: 'CP1',
    query: '父子分块和普通分块有什么区别？',
    category: 'comparative',
    difficulty: 'medium',
    description: '查询分块策略对比',
    expected: {
      minResults: 2,
      expectedKeywords: ['父块', '子块', '上下文', '章节', '层级'],
      relevantLayers: ['parent', 'document'],
    },
  },
  {
    id: 'CP2',
    query: 'Cosine 距离和 Euclidean 距离哪个更适合向量检索？',
    category: 'comparative',
    difficulty: 'hard',
    description: '查询距离度量对比',
    expected: {
      minResults: 1,
      expectedKeywords: ['cosine', 'euclidean', '相似度', '角度', '距离'],
      relevantLayers: ['parent', 'child'],
    },
  },
  {
    id: 'CP3',
    query: 'COS 对象存储和本地存储有什么区别？',
    category: 'comparative',
    difficulty: 'medium',
    description: '查询存储方案对比',
    expected: {
      minResults: 1,
      expectedKeywords: ['COS', '腾讯云', '本地', '存储', 'base64'],
      relevantLayers: ['parent'],
    },
  },
  {
    id: 'CP4',
    query: '三层检索和直接检索子块哪个更好？',
    category: 'comparative',
    difficulty: 'hard',
    description: '查询检索策略对比',
    expected: {
      minResults: 1,
      expectedKeywords: ['三层', 'drill-down', '摘要', '上下文', '精确'],
      relevantLayers: ['document', 'parent'],
    },
  },

  // ==================== 综合性查询 ====================
  {
    id: 'X1',
    query: '为什么要用三层RAG检索而不是直接检索子块？',
    category: 'complex',
    difficulty: 'hard',
    description: '查询设计意图',
    expected: {
      minResults: 2,
      expectedKeywords: ['KTYPE', '摘要', '章节', '上下文', '效率'],
      relevantLayers: ['document', 'parent'],
    },
  },
  {
    id: 'X2',
    query: '完整的文档处理流程是什么？',
    category: 'complex',
    difficulty: 'medium',
    description: '查询端到端流程',
    expected: {
      minResults: 2,
      expectedKeywords: ['解析', 'KTYPE', '分块', '向量化', 'Qdrant', 'embedding'],
      relevantLayers: ['document', 'parent'],
    },
  },
  {
    id: 'X3',
    query: 'KTYPE 分析结果如何影响检索质量？',
    category: 'complex',
    difficulty: 'hard',
    description: '查询因果关系',
    expected: {
      minResults: 2,
      expectedKeywords: ['摘要', '相关度', '文档层', '过滤'],
      relevantLayers: ['document', 'parent', 'child'],
    },
  },
  {
    id: 'X4',
    query: 'ContextOS 的技术架构包含哪些组件？',
    category: 'complex',
    difficulty: 'medium',
    description: '查询系统架构',
    expected: {
      minResults: 2,
      expectedKeywords: ['Next.js', 'Qdrant', 'LLM', 'embedding', 'API'],
      relevantLayers: ['document', 'parent'],
    },
  },

  // ==================== 边界情况查询 ====================
  {
    id: 'B1',
    query: '量子力学的基本原理是什么？',
    category: 'boundary',
    difficulty: 'easy',
    description: '无关查询 - 系统中没有相关内容',
    expected: {
      minResults: 0,
      expectedKeywords: [],
    },
  },
  {
    id: 'B2',
    query: '部署',
    category: 'boundary',
    difficulty: 'medium',
    description: '歧义查询 - 可能有多个相关章节',
    expected: {
      minResults: 1,
      expectedKeywords: ['部署', '环境变量', '配置', 'Vercel'],
    },
  },
  {
    id: 'B3',
    query: 'a',
    category: 'boundary',
    difficulty: 'easy',
    description: '过短查询 - 单字符',
    expected: {
      minResults: 0,
      expectedKeywords: [],
    },
  },
  {
    id: 'B4',
    query: '怎么在系统里找到我去年上传的PDF文件并重新索引？',
    category: 'boundary',
    difficulty: 'challenge',
    description: '复杂多步骤查询',
    expected: {
      minResults: 1,
      expectedKeywords: ['文档', '搜索', '重新处理', '索引'],
    },
  },
  {
    id: 'B5',
    query: '系统支持哪些语言？',
    category: 'boundary',
    difficulty: 'medium',
    description: '可能没有明确答案的查询',
    expected: {
      minResults: 0,
      expectedKeywords: [],
    },
  },

  // ==================== 多文档筛选查询 ====================
  {
    id: 'M1',
    query: '如何配置环境变量？',
    category: 'multi-doc',
    difficulty: 'medium',
    description: '需要选中技术文档类',
    expected: {
      minResults: 2,
      expectedKeywords: ['.env', '环境变量', '配置'],
      expectedDocTypes: ['技术文档'],
    },
  },
  {
    id: 'M2',
    query: '创建知识库的步骤是什么？',
    category: 'multi-doc',
    difficulty: 'easy',
    description: '可能在多个文档中都有提及',
    expected: {
      minResults: 2,
      expectedKeywords: ['创建', '知识库', '步骤'],
    },
  },
  {
    id: 'M3',
    query: '向量检索的阈值怎么设置？',
    category: 'multi-doc',
    difficulty: 'hard',
    description: '技术参数配置',
    expected: {
      minResults: 1,
      expectedKeywords: ['scoreThreshold', '阈值', '相关度'],
    },
  },
]

/**
 * 测试用例分组
 */
export const TEST_CASE_GROUPS = {
  factual: TEST_CASES.filter(tc => tc.category === 'factual'),
  conceptual: TEST_CASES.filter(tc => tc.category === 'conceptual'),
  procedural: TEST_CASES.filter(tc => tc.category === 'procedural'),
  comparative: TEST_CASES.filter(tc => tc.category === 'comparative'),
  complex: TEST_CASES.filter(tc => tc.category === 'complex'),
  boundary: TEST_CASES.filter(tc => tc.category === 'boundary'),
  multiDoc: TEST_CASES.filter(tc => tc.category === 'multi-doc'),

  // 按难度分组
  easy: TEST_CASES.filter(tc => tc.difficulty === 'easy'),
  medium: TEST_CASES.filter(tc => tc.difficulty === 'medium'),
  hard: TEST_CASES.filter(tc => tc.difficulty === 'hard'),
  challenge: TEST_CASES.filter(tc => tc.difficulty === 'challenge'),
}

/**
 * 测试配置
 */
export const TEST_CONFIG = {
  // 默认检索参数
  defaultParams: {
    scoreThreshold: 0.3,
    documentLimit: 1,
    parentLimit: 2,
    childLimit: 5,
  },

  // 评估阈值
  thresholds: {
    excellent: 0.85,
    good: 0.70,
    fair: 0.55,
  },

  // 相关性评分权重
  relevanceWeights: {
    keywordMatch: 0.3,
    layerMatch: 0.2,
    contentRelevance: 0.5,
  },
}

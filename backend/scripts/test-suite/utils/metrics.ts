/**
 * 性能指标和阈值定义
 */

export interface Threshold {
  name: string
  target: number  // 目标时间 (ms)
  warning: number // 警告阈值 (ms)
  critical: number // 危险阈值 (ms)
}

export interface MetricCheck {
  name: string
  actual: number
  threshold: Threshold
  status: 'pass' | 'warning' | 'critical' | 'fail'
}

/**
 * 性能基线定义
 */
export const THRESHOLDS: Record<string, Threshold> = {
  // 基础设施
  'infra.redis': { name: 'Redis PING', target: 10, warning: 50, critical: 500 },
  'infra.supabase': { name: 'Supabase Query', target: 100, warning: 500, critical: 2000 },
  'infra.oneapi': { name: 'OneAPI LLM', target: 1000, warning: 5000, critical: 15000 },
  'infra.embedding': { name: 'Embedding API', target: 500, warning: 2000, critical: 5000 },

  // 解析
  'parse.pdf': { name: 'PDF Parse (1 page)', target: 500, warning: 2000, critical: 5000 },
  'parse.docx': { name: 'DOCX Parse', target: 200, warning: 1000, critical: 3000 },
  'parse.txt': { name: 'TXT Parse', target: 10, warning: 50, critical: 200 },

  // 分块
  'chunk.small': { name: 'Chunk (100 tokens)', target: 10, warning: 50, critical: 200 },
  'chunk.medium': { name: 'Chunk (1000 tokens)', target: 50, warning: 200, critical: 1000 },
  'chunk.large': { name: 'Chunk (10000 tokens)', target: 200, warning: 1000, critical: 5000 },

  // K-Type 处理 (LLM 调用，时间较长)
  'ktype.scan': { name: 'K-Type Scan', target: 30000, warning: 60000, critical: 120000 },
  'ktype.classify': { name: 'K-Type Classify', target: 20000, warning: 40000, critical: 60000 },
  'ktype.audit': { name: 'K-Type Audit', target: 30000, warning: 60000, critical: 90000 },
  'ktype.fast': { name: 'K-Type Fast Mode (1 LLM)', target: 30000, warning: 60000, critical: 120000 },
  'ktype.full': { name: 'K-Type Full Workflow (4 LLM)', target: 80000, warning: 150000, critical: 270000 },

  // Embedding
  'embedding.single': { name: 'Embedding (1)', target: 200, warning: 1000, critical: 3000 },
  'embedding.batch10': { name: 'Embedding (batch 10)', target: 1000, warning: 3000, critical: 10000 },
  'embedding.batch50': { name: 'Embedding (batch 50)', target: 3000, warning: 10000, critical: 30000 },

  // 数据库操作
  'db.insert.parent': { name: 'Insert Parent Chunk', target: 50, warning: 200, critical: 1000 },
  'db.insert.child': { name: 'Insert Child Chunk', target: 50, warning: 200, critical: 1000 },
  'db.insert.batch': { name: 'Insert Batch (50)', target: 1000, warning: 3000, critical: 10000 },
}

/**
 * 检查性能指标
 */
export function checkMetric(key: string, actual: number): MetricCheck {
  const threshold = THRESHOLDS[key]
  if (!threshold) {
    return {
      name: key,
      actual,
      threshold: { name: key, target: 0, warning: 0, critical: 0 },
      status: 'pass',
    }
  }

  let status: MetricCheck['status'] = 'pass'
  if (actual > threshold.critical) {
    status = 'critical'
  } else if (actual > threshold.warning) {
    status = 'warning'
  }

  return {
    name: key,
    actual,
    threshold,
    status,
  }
}

/**
 * 格式化指标状态
 */
export function formatMetricCheck(check: MetricCheck): string {
  const statusIcon = {
    pass: '✅',
    warning: '⚠️ ',
    critical: '🔴',
    fail: '❌',
  }[check.status]

  const actualStr = formatDuration(check.actual)
  const targetStr = formatDuration(check.threshold.target)

  return `${statusIcon} ${check.threshold.name.padEnd(25)} 实际: ${actualStr.padStart(8)} | 目标: <${targetStr}`
}

// Helper function to format duration (avoid circular dependency)
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 1000).toFixed(1)}s`
}

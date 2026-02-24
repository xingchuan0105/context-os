import axios from 'axios'
import { mergeHeaders } from './capability-headers'

export type AdminLiteLLMDailyUsagePoint = {
  date: string
  spend: number
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AdminLiteLLMProviderUsagePoint = {
  provider: string
  spend: number
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AdminLiteLLMModelUsagePoint = {
  model: string
  spend: number
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AdminLiteLLMModelDailyUsagePoint = {
  date: string
  model: string
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AdminLiteLLMUsageSummary = {
  generatedAt: string
  range: {
    days: number
    from: string
    to: string
    timezone: 'UTC'
  }
  available: boolean
  endpoint: string | null
  warning: string | null
  totals: {
    spend: number
    apiRequests: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  daily: AdminLiteLLMDailyUsagePoint[]
  providers: AdminLiteLLMProviderUsagePoint[]
  models: AdminLiteLLMModelUsagePoint[]
  modelDaily: AdminLiteLLMModelDailyUsagePoint[]
}

type UsageAccumulator = {
  spend: number
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

function emptyUsageAccumulator(): UsageAccumulator {
  return {
    spend: 0,
    apiRequests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }
}

function asNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function roundTo(value: number, digits: number = 6): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function normalizeDate(value: string): string {
  return value.slice(0, 10)
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function utcDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return toDateOnly(date)
}

function buildDateSeries(days: number): string[] {
  const series: string[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    series.push(utcDateDaysAgo(offset))
  }
  return series
}

function getStartAndEnd(days: number): { from: string; to: string } {
  const to = utcDateDaysAgo(0)
  const from = utcDateDaysAgo(Math.max(0, days - 1))
  return { from, to }
}

function normalizeEndpoint(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function resolveUsageEndpoints(): string[] {
  const envValue = process.env.LITELLM_USAGE_ENDPOINTS || ''
  if (envValue.trim()) {
    return envValue
      .split(',')
      .map((item) => normalizeEndpoint(item))
      .filter((item) => Boolean(item))
  }

  return ['/user/daily/activity', '/global/spend/logs']
}

function parseHeadersFromEnv(): Record<string, string> | undefined {
  const raw = process.env.LITELLM_USAGE_HEADERS_JSON
  if (!raw || !raw.trim()) return undefined

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key || typeof key !== 'string') continue
      if (value === null || value === undefined) continue
      const normalized = typeof value === 'string' ? value.trim() : String(value)
      if (!normalized) continue
      headers[key.trim()] = normalized
    }

    return Object.keys(headers).length > 0 ? headers : undefined
  } catch {
    return undefined
  }
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const asRecord = payload as Record<string, unknown>

  if (Array.isArray(asRecord.results)) {
    return asRecord.results.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  }

  if (Array.isArray(asRecord.data)) {
    return asRecord.data.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
  }

  if (asRecord.results && typeof asRecord.results === 'object') {
    const nested = asRecord.results as Record<string, unknown>
    if (Array.isArray(nested.data)) {
      return nested.data.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
    }
  }

  return []
}

function pickDate(row: Record<string, unknown>): string | null {
  const dateValue =
    (typeof row.date === 'string' && row.date) ||
    (typeof row.day === 'string' && row.day) ||
    (typeof row.created_at === 'string' && row.created_at) ||
    (typeof row.timestamp === 'string' && row.timestamp) ||
    ''

  if (!dateValue) return null
  return normalizeDate(dateValue)
}

function normalizeMetricsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const source = value as Record<string, unknown>
  const nestedMetrics = source.metrics

  if (nestedMetrics && typeof nestedMetrics === 'object' && !Array.isArray(nestedMetrics)) {
    return nestedMetrics as Record<string, unknown>
  }

  return source
}

function parseUsageMetrics(value: unknown): UsageAccumulator {
  if (typeof value === 'number') {
    return {
      ...emptyUsageAccumulator(),
      spend: asNumber(value),
    }
  }

  const source = normalizeMetricsObject(value)
  if (Object.keys(source).length === 0) {
    return emptyUsageAccumulator()
  }

  const promptTokens = asNumber(source.prompt_tokens ?? source.promptTokens)
  const completionTokens = asNumber(source.completion_tokens ?? source.completionTokens)
  const totalTokens = asNumber(source.total_tokens ?? source.totalTokens) || promptTokens + completionTokens

  const successfulRequests = asNumber(source.successful_requests ?? source.successfulRequests)
  const failedRequests = asNumber(source.failed_requests ?? source.failedRequests)
  const apiRequests =
    asNumber(source.api_requests ?? source.apiRequests) || successfulRequests + failedRequests

  return {
    spend: asNumber(source.spend),
    apiRequests,
    promptTokens,
    completionTokens,
    totalTokens,
  }
}

function addUsage(target: UsageAccumulator, source: UsageAccumulator): void {
  target.spend += source.spend
  target.apiRequests += source.apiRequests
  target.promptTokens += source.promptTokens
  target.completionTokens += source.completionTokens
  target.totalTokens += source.totalTokens
}

function parseUsageBreakdownByKey(
  breakdown: unknown,
  key: 'providers' | 'models',
): Record<string, UsageAccumulator> {
  const result: Record<string, UsageAccumulator> = {}

  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) {
    return result
  }

  const itemMap = (breakdown as Record<string, unknown>)[key]
  if (!itemMap || typeof itemMap !== 'object' || Array.isArray(itemMap)) {
    return result
  }

  for (const [name, rawMetrics] of Object.entries(itemMap as Record<string, unknown>)) {
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    if (!normalizedName) continue

    result[normalizedName] = parseUsageMetrics(rawMetrics)
  }

  return result
}

function isAllZeroMetrics(metrics: UsageAccumulator): boolean {
  return (
    metrics.spend === 0 &&
    metrics.apiRequests === 0 &&
    metrics.promptTokens === 0 &&
    metrics.completionTokens === 0 &&
    metrics.totalTokens === 0
  )
}

function sumAccumulatorMapValues(input: Record<string, UsageAccumulator>): UsageAccumulator {
  const sum = emptyUsageAccumulator()
  for (const metrics of Object.values(input)) {
    addUsage(sum, metrics)
  }
  return sum
}

function parseDailyRow(row: Record<string, unknown>): {
  date: string
  totals: UsageAccumulator
  providers: Record<string, UsageAccumulator>
  models: Record<string, UsageAccumulator>
} | null {
  const date = pickDate(row)
  if (!date) return null

  const totals = parseUsageMetrics(row)
  const providers = parseUsageBreakdownByKey(row.breakdown, 'providers')
  const models = parseUsageBreakdownByKey(row.breakdown, 'models')

  if (isAllZeroMetrics(totals)) {
    const providerTotals = sumAccumulatorMapValues(providers)
    if (!isAllZeroMetrics(providerTotals)) {
      addUsage(totals, providerTotals)
    } else {
      const modelTotals = sumAccumulatorMapValues(models)
      if (!isAllZeroMetrics(modelTotals)) {
        addUsage(totals, modelTotals)
      }
    }
  }

  return {
    date,
    totals,
    providers,
    models,
  }
}

function emptySummary(days: number, warning: string, endpoint: string | null): AdminLiteLLMUsageSummary {
  const { from, to } = getStartAndEnd(days)
  const daily = buildDateSeries(days).map((date) => ({
    date,
    spend: 0,
    apiRequests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }))

  return {
    generatedAt: new Date().toISOString(),
    range: {
      days,
      from,
      to,
      timezone: 'UTC',
    },
    available: false,
    endpoint,
    warning,
    totals: {
      spend: 0,
      apiRequests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    daily,
    providers: [],
    models: [],
    modelDaily: [],
  }
}

function buildSummaryFromRows(
  days: number,
  endpoint: string,
  rows: Array<Record<string, unknown>>,
): AdminLiteLLMUsageSummary {
  const { from, to } = getStartAndEnd(days)
  const dailyMap = new Map<string, UsageAccumulator>()
  const providerMap = new Map<string, UsageAccumulator>()
  const modelMap = new Map<string, UsageAccumulator>()
  const modelDailyMap = new Map<string, UsageAccumulator>()

  for (const row of rows) {
    const parsed = parseDailyRow(row)
    if (!parsed) continue

    if (!dailyMap.has(parsed.date)) {
      dailyMap.set(parsed.date, emptyUsageAccumulator())
    }

    addUsage(dailyMap.get(parsed.date) as UsageAccumulator, parsed.totals)

    for (const [provider, metrics] of Object.entries(parsed.providers)) {
      if (!providerMap.has(provider)) {
        providerMap.set(provider, emptyUsageAccumulator())
      }
      addUsage(providerMap.get(provider) as UsageAccumulator, metrics)
    }

    for (const [model, metrics] of Object.entries(parsed.models)) {
      if (!modelMap.has(model)) {
        modelMap.set(model, emptyUsageAccumulator())
      }
      addUsage(modelMap.get(model) as UsageAccumulator, metrics)

      const modelDailyKey = parsed.date + '@@' + model
      if (!modelDailyMap.has(modelDailyKey)) {
        modelDailyMap.set(modelDailyKey, emptyUsageAccumulator())
      }
      addUsage(modelDailyMap.get(modelDailyKey) as UsageAccumulator, metrics)
    }
  }

  const dateSeries = buildDateSeries(days)
  const daily: AdminLiteLLMDailyUsagePoint[] = dateSeries.map((date) => {
    const metrics = dailyMap.get(date) || emptyUsageAccumulator()

    return {
      date,
      spend: roundTo(metrics.spend),
      apiRequests: Math.round(metrics.apiRequests),
      promptTokens: Math.round(metrics.promptTokens),
      completionTokens: Math.round(metrics.completionTokens),
      totalTokens: Math.round(metrics.totalTokens),
    }
  })

  const providers = Array.from(providerMap.entries())
    .map(([provider, metrics]) => ({
      provider,
      spend: roundTo(metrics.spend),
      apiRequests: Math.round(metrics.apiRequests),
      promptTokens: Math.round(metrics.promptTokens),
      completionTokens: Math.round(metrics.completionTokens),
      totalTokens: Math.round(metrics.totalTokens),
    }))
    .sort((a, b) => b.spend - a.spend || b.totalTokens - a.totalTokens)

  const models = Array.from(modelMap.entries())
    .map(([model, metrics]) => ({
      model,
      spend: roundTo(metrics.spend),
      apiRequests: Math.round(metrics.apiRequests),
      promptTokens: Math.round(metrics.promptTokens),
      completionTokens: Math.round(metrics.completionTokens),
      totalTokens: Math.round(metrics.totalTokens),
    }))
    .sort((a, b) => b.spend - a.spend || b.totalTokens - a.totalTokens)

  const modelDaily = Array.from(modelDailyMap.entries())
    .map(([key, metrics]) => {
      const [date, model] = key.split('@@')
      return {
        date,
        model,
        apiRequests: Math.round(metrics.apiRequests),
        promptTokens: Math.round(metrics.promptTokens),
        completionTokens: Math.round(metrics.completionTokens),
        totalTokens: Math.round(metrics.totalTokens),
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || b.totalTokens - a.totalTokens)

  const totals = daily.reduce(
    (acc, item) => {
      acc.spend += item.spend
      acc.apiRequests += item.apiRequests
      acc.promptTokens += item.promptTokens
      acc.completionTokens += item.completionTokens
      acc.totalTokens += item.totalTokens
      return acc
    },
    emptyUsageAccumulator(),
  )

  return {
    generatedAt: new Date().toISOString(),
    range: {
      days,
      from,
      to,
      timezone: 'UTC',
    },
    available: true,
    endpoint,
    warning: rows.length === 0 ? 'LiteLLM 接口可用，但当前时间窗口无用量数据。' : null,
    totals: {
      spend: roundTo(totals.spend),
      apiRequests: Math.round(totals.apiRequests),
      promptTokens: Math.round(totals.promptTokens),
      completionTokens: Math.round(totals.completionTokens),
      totalTokens: Math.round(totals.totalTokens),
    },
    daily,
    providers,
    models,
    modelDaily,
  }
}

export async function getAdminLiteLLMUsageSummary(input?: {
  days?: number
}): Promise<AdminLiteLLMUsageSummary> {
  const days = Math.max(1, Math.min(90, Math.floor(input?.days ?? 30)))
  const baseUrl = process.env.LITELLM_USAGE_BASE_URL || process.env.LITELLM_BASE_URL || ''
  const apiKey =
    process.env.LITELLM_USAGE_API_KEY ||
    process.env.LITELLM_MASTER_KEY ||
    process.env.LITELLM_API_KEY ||
    ''

  if (!baseUrl.trim()) {
    return emptySummary(days, '未配置 LiteLLM 地址：请设置 LITELLM_USAGE_BASE_URL 或 LITELLM_BASE_URL。', null)
  }

  if (!apiKey.trim()) {
    return emptySummary(days, '未配置 LiteLLM 管理 Key：请设置 LITELLM_USAGE_API_KEY 或 LITELLM_MASTER_KEY。', null)
  }

  const endpoints = resolveUsageEndpoints()
  const timeoutMs = Math.max(1000, Math.min(60_000, Math.floor(asNumber(process.env.LITELLM_USAGE_TIMEOUT_MS) || 15000)))
  const extraHeaders = parseHeadersFromEnv()
  const { from, to } = getStartAndEnd(days)
  const headers = mergeHeaders(
    extraHeaders,
    {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
  )

  const base = normalizeBaseUrl(baseUrl)
  const errors: string[] = []

  for (const endpoint of endpoints) {
    const requestUrl = `${base}${endpoint}`

    try {
      const response = await axios.get(requestUrl, {
        params: {
          start_date: from,
          end_date: to,
        },
        headers,
        timeout: timeoutMs,
      })

      const rows = extractRows(response.data)
      return buildSummaryFromRows(days, endpoint, rows)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        const message = error.response?.data
          ? typeof error.response.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response.data)
          : error.message
        errors.push(`${endpoint} -> ${status || 'ERR'} ${message}`)
      } else {
        errors.push(`${endpoint} -> ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  const warning =
    errors.length > 0
      ? `LiteLLM 用量接口调用失败：${errors.slice(0, 2).join('；')}`
      : 'LiteLLM 用量接口不可用。'

  return emptySummary(days, warning, endpoints[0] || null)
}

'use client'

import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminLiteLLMUsage,
  useAdminMetrics,
  useRefreshAdminLiteLLMUsage,
  useRefreshAdminMetrics,
} from '@/lib/hooks/use-admin-metrics'
import { useI18n } from '@/lib/i18n'
import {
  type AdminLiteLLMUsageResponse,
  type AdminMetricsCountPoint,
  type AdminMetricsOverviewResponse,
  type AdminMetricsTokenPoint,
} from '@/lib/types/api'
import { formatBytes, formatNumber } from '@/lib/utils/format'
import {
  Activity,
  Coins,
  Database,
  Download,
  FileText,
  RefreshCw,
  Server,
  ShieldAlert,
  Users,
} from 'lucide-react'

const DAY_OPTIONS = [7, 30, 60, 90] as const
const TOP_USER_OPTIONS = [5, 10, 20, 50] as const

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined
    return data?.error?.message || data?.message || error.message || fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function isForbiddenError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 403
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}


function formatDate(value: string, locale: 'zh' | 'en'): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
    {
      month: '2-digit',
      day: '2-digit',
    },
  )
}

function formatDateTime(value: string, locale: 'zh' | 'en'): string {
  return new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type LiteLLMModelDailyPoint = {
  date: string
  model: string
  apiRequests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (!/[",\n]/.test(text)) {
    return text
  }
  return '"' + text.replace(/"/g, '""') + '"'
}

function buildCsvRow(values: unknown[]): string {
  return values.map((value) => escapeCsvValue(value)).join(',')
}

function getLiteLLMModelDailyPoints(usage: AdminLiteLLMUsageResponse): LiteLLMModelDailyPoint[] {
  const raw = (usage as unknown as { modelDaily?: LiteLLMModelDailyPoint[] }).modelDaily
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item) => item && typeof item === 'object')
}

function buildLiteLLMUsageCsv(usage: AdminLiteLLMUsageResponse): string {
  const rows: string[] = []
  const modelDaily = getLiteLLMModelDailyPoints(usage)

  rows.push(buildCsvRow(['generated_at', usage.generatedAt]))
  rows.push(buildCsvRow(['range_from', usage.range.from]))
  rows.push(buildCsvRow(['range_to', usage.range.to]))
  rows.push(buildCsvRow(['endpoint', usage.endpoint || '']))
  rows.push(buildCsvRow(['total_api_requests', usage.totals.apiRequests]))
  rows.push(buildCsvRow(['total_prompt_tokens', usage.totals.promptTokens]))
  rows.push(buildCsvRow(['total_completion_tokens', usage.totals.completionTokens]))
  rows.push(buildCsvRow(['total_tokens', usage.totals.totalTokens]))

  rows.push('')
  rows.push(buildCsvRow(['daily_date', 'api_requests', 'prompt_tokens', 'completion_tokens', 'total_tokens']))
  for (const dailyPoint of usage.daily) {
    rows.push(
      buildCsvRow([
        dailyPoint.date,
        dailyPoint.apiRequests,
        dailyPoint.promptTokens,
        dailyPoint.completionTokens,
        dailyPoint.totalTokens,
      ]),
    )
  }

  rows.push('')
  rows.push(buildCsvRow(['model', 'api_requests', 'prompt_tokens', 'completion_tokens', 'total_tokens']))
  for (const modelPoint of usage.models) {
    rows.push(
      buildCsvRow([
        modelPoint.model,
        modelPoint.apiRequests,
        modelPoint.promptTokens,
        modelPoint.completionTokens,
        modelPoint.totalTokens,
      ]),
    )
  }

  rows.push('')
  rows.push(
    buildCsvRow(['model_daily_date', 'model', 'api_requests', 'prompt_tokens', 'completion_tokens', 'total_tokens']),
  )
  for (const point of modelDaily) {
    rows.push(
      buildCsvRow([
        point.date,
        point.model,
        point.apiRequests,
        point.promptTokens,
        point.completionTokens,
        point.totalTokens,
      ]),
    )
  }

  return rows.join('\n')
}

function downloadLiteLLMUsageCsv(usage: AdminLiteLLMUsageResponse): void {
  const csv = buildLiteLLMUsageCsv(usage)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const filename = 'litellm-model-usage-' + usage.range.from + '_to_' + usage.range.to + '.csv'

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
function MetricKpi(props: {
  title: string
  value: string
  hint?: string
}) {
  const { title, value, hint } = props

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold leading-none">{value}</div>
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function CountTrendChart(props: {
  title: string
  points: AdminMetricsCountPoint[]
  locale: 'zh' | 'en'
}) {
  const { title, points, locale } = props

  const recentPoints = points.slice(-14)
  const maxValue = Math.max(...recentPoints.map((point) => point.value), 1)
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale],
  )

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>近 14 天趋势</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentPoints.map((point) => {
          const percentage = Math.max(4, (point.value / maxValue) * 100)
          return (
            <div key={point.date} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(point.date, locale)}</span>
                <span>{numberFormatter.format(point.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function TokenTrendChart(props: {
  points: AdminMetricsTokenPoint[]
  locale: 'zh' | 'en'
}) {
  const { points, locale } = props

  const recentPoints = points.slice(-14)
  const maxValue = Math.max(...recentPoints.map((point) => point.totalTokens), 1)
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale],
  )

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Token 日趋势</CardTitle>
        <CardDescription>近 14 天估算 Token 用量</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentPoints.map((point) => {
          const percentage = Math.max(4, (point.totalTokens / maxValue) * 100)
          return (
            <div key={point.date} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(point.date, locale)}</span>
                <span>{numberFormatter.format(point.totalTokens)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/70"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function TopUsersCard(props: {
  metrics: AdminMetricsOverviewResponse
  locale: 'zh' | 'en'
  topUsersLimit: number
}) {
  const { metrics, locale, topUsersLimit } = props
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale],
  )

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top 用户（30 天 Token）</CardTitle>
        <CardDescription>展示前 {topUsersLimit} 位</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.tokens.topUsers.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无数据</div>
        ) : (
          metrics.tokens.topUsers.map((user, index) => (
            <div
              key={`${user.userId}-${index}`}
              className="rounded-lg border border-border/70 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">#{index + 1} {user.email}</div>
                <Badge variant="secondary">{numberFormatter.format(user.totalTokens)}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Prompt {numberFormatter.format(user.promptTokens)} · Completion {numberFormatter.format(user.completionTokens)} · 消息 {numberFormatter.format(user.messageCount)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function LiteLLMUsageCard(props: {
  usage?: AdminLiteLLMUsageResponse
  loading: boolean
  error: unknown
  locale: 'zh' | 'en'
}) {
  const { usage, loading, error, locale } = props
  const [selectedModel, setSelectedModel] = useState<string>('__all__')
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale],
  )

  const modelDailyPoints = useMemo(() => {
    if (!usage) return []
    return getLiteLLMModelDailyPoints(usage)
  }, [usage])

  const selectedModelDailyPoints = useMemo(() => {
    if (selectedModel === '__all__') {
      return modelDailyPoints
    }
    return modelDailyPoints.filter((point) => point.model === selectedModel)
  }, [modelDailyPoints, selectedModel])

  const selectedModelDailyMap = useMemo(() => {
    const map = new Map<string, LiteLLMModelDailyPoint>()
    for (const point of selectedModelDailyPoints) {
      map.set(point.date, point)
    }
    return map
  }, [selectedModelDailyPoints])

  const selectedModelSeries = useMemo(() => {
    if (!usage) {
      return [] as Array<{ date: string; totalTokens: number; apiRequests: number }>
    }

    return usage.daily.map((dailyPoint) => {
      const modelPoint = selectedModelDailyMap.get(dailyPoint.date)
      return {
        date: dailyPoint.date,
        totalTokens: modelPoint?.totalTokens || 0,
        apiRequests: modelPoint?.apiRequests || 0,
      }
    })
  }, [usage, selectedModelDailyMap])

  const selectedModelTotalTokens = useMemo(() => {
    return selectedModelSeries.reduce((sum, point) => sum + point.totalTokens, 0)
  }, [selectedModelSeries])

  const selectedModelName = selectedModel === '__all__' ? '全部模型' : selectedModel
  const canExport = Boolean(usage && usage.available)

  const handleExport = () => {
    if (!usage || !usage.available) return
    downloadLiteLLMUsageCsv(usage)
  }

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              LiteLLM 模型 Token 用量（按时间）
            </CardTitle>
            <CardDescription>来自 LiteLLM 管理接口（优先 `/user/daily/activity`）</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!canExport || loading || Boolean(error)}
          >
            <Download className="h-4 w-4 mr-2" />
            导出模型 Token CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : error ? (
          <div className="text-sm text-red-500">
            {getErrorMessage(error, 'LiteLLM 用量数据加载失败')}
          </div>
        ) : !usage ? (
          <div className="text-sm text-muted-foreground">暂无数据</div>
        ) : !usage.available ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">LiteLLM 真实用量暂不可用。</div>
            {usage.warning ? (
              <div className="text-xs text-muted-foreground break-all">{usage.warning}</div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MetricKpi title="请求数" value={numberFormatter.format(usage.totals.apiRequests)} />
              <MetricKpi title="总 Token" value={numberFormatter.format(usage.totals.totalTokens)} />
              <MetricKpi title="Prompt Token" value={numberFormatter.format(usage.totals.promptTokens)} />
              <MetricKpi title="Completion Token" value={numberFormatter.format(usage.totals.completionTokens)} />
              <MetricKpi title="模型数量" value={numberFormatter.format(usage.models.length)} />
              <MetricKpi
                title={`${selectedModelName} Token`}
                value={numberFormatter.format(selectedModelTotalTokens)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">模型筛选（时间序列）</label>
                <Select
                  value={selectedModel}
                  onValueChange={(value) => setSelectedModel(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部模型</SelectItem>
                    {usage.models.map((item) => (
                      <SelectItem key={item.model} value={item.model}>
                        {item.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">模型 Top 列表（按 Token）</label>
                <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                  {usage.models.length === 0 ? (
                    <span>当前窗口无模型统计</span>
                  ) : (
                    usage.models.slice(0, 5).map((item, index) => (
                      <div key={item.model} className="flex items-center justify-between py-0.5">
                        <span className="truncate">#{index + 1} {item.model}</span>
                        <span>{numberFormatter.format(item.totalTokens)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <Card className="border-border/70 bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{selectedModelName} · 日 Token 趋势</CardTitle>
                <CardDescription>近 {usage.range.days} 天，按 UTC 日期聚合</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedModelSeries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无时间序列数据</div>
                ) : (
                  selectedModelSeries.slice(-14).map((point) => {
                    const maxValue = Math.max(
                      ...selectedModelSeries.map((item) => item.totalTokens),
                      1,
                    )
                    const percentage = Math.max(4, (point.totalTokens / maxValue) * 100)

                    return (
                      <div key={point.date} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDate(point.date, locale)}</span>
                          <span>
                            Token {numberFormatter.format(point.totalTokens)} · 请求 {numberFormatter.format(point.apiRequests)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={usage.meta.cache.hit ? 'secondary' : 'outline'}>
                cache {usage.meta.cache.hit ? 'hit' : 'miss'}
              </Badge>
              {usage.meta.cache.stale ? <Badge variant="destructive">stale</Badge> : null}
              <Badge variant="outline">TTL {usage.meta.cache.ttlSeconds}s</Badge>
              <span>endpoint: {usage.endpoint || '-'}</span>
            </div>

            {usage.warning ? (
              <div className="text-xs text-muted-foreground break-all">{usage.warning}</div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
function RetentionCard(props: {
  metrics: AdminMetricsOverviewResponse
  locale: 'zh' | 'en'
}) {
  const { metrics, locale } = props

  const rows = metrics.activity.retentionSeries.slice(-10)

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cohort 留存（最近 10 个注册日）</CardTitle>
        <CardDescription>D1 / D7 留存率</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无数据</div>
        ) : (
          rows.map((row) => (
            <div key={row.cohortDate} className="rounded-lg border border-border/70 px-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{formatDate(row.cohortDate, locale)}</span>
                <span className="text-muted-foreground">注册 {row.registeredUsers}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                D1 {formatPercent(row.d1Rate)} · D7 {formatPercent(row.d7Rate)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function AdminMetricsDashboard() {
  const { locale } = useI18n()
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US'),
    [locale],
  )

  const [days, setDays] = useState<number>(30)
  const [topUsers, setTopUsers] = useState<number>(10)

  const metricsQuery = useAdminMetrics({ days, topUsers })
  const liteLLMUsageQuery = useAdminLiteLLMUsage({ days })
  const refreshMutation = useRefreshAdminMetrics()
  const refreshLiteLLMMutation = useRefreshAdminLiteLLMUsage()

  const metrics = metricsQuery.data
  const liteLLMUsage = liteLLMUsageQuery.data
  const loading = metricsQuery.isLoading && !metrics
  const hasError = Boolean(metricsQuery.error) && !metrics

  const handleForceRefresh = async () => {
    await Promise.allSettled([
      refreshMutation.mutateAsync({ days, topUsers }),
      refreshLiteLLMMutation.mutateAsync({ days }),
    ])
  }

  const errorTitle = isUnauthorizedError(metricsQuery.error)
    ? '未登录'
    : isForbiddenError(metricsQuery.error)
      ? '权限不足'
      : '加载失败'

  const errorMessage = isUnauthorizedError(metricsQuery.error)
    ? '请先登录后访问管理后台。'
    : isForbiddenError(metricsQuery.error)
      ? '该页面仅管理员可访问。请在后端配置 ADMIN_SUPER_EMAIL / ADMIN_SUPER_PASSWORD 或普通管理员账号。'
      : getErrorMessage(metricsQuery.error, '管理指标加载失败，请稍后重试。')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">运营指标与报表</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            统一查看用户、文件、Token、活跃与留存指标，支持缓存刷新与快速排障。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(days)}
            onValueChange={(value) => setDays(Number(value))}
          >
            <SelectTrigger className="w-[120px] bg-card/70 border-border/60">
              <SelectValue placeholder="统计范围" />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  最近 {option} 天
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(topUsers)}
            onValueChange={(value) => setTopUsers(Number(value))}
          >
            <SelectTrigger className="w-[120px] bg-card/70 border-border/60">
              <SelectValue placeholder="Top 用户" />
            </SelectTrigger>
            <SelectContent>
              {TOP_USER_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Top {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => Promise.allSettled([metricsQuery.refetch(), liteLLMUsageQuery.refetch()])}
            disabled={metricsQuery.isFetching || liteLLMUsageQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>

          <Button
            onClick={handleForceRefresh}
            disabled={refreshMutation.isPending || refreshLiteLLMMutation.isPending}
          >
            <Database className="h-4 w-4 mr-2" />
            {refreshMutation.isPending || refreshLiteLLMMutation.isPending ? '强制刷新中...' : '强制刷新（绕过缓存）'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-10 text-center text-sm text-muted-foreground">
          <LoadingSpinner />
        </div>
      ) : null}

      {hasError ? (
        <Alert variant="destructive" className="border-red-400/40">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !hasError && metrics ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={metrics.meta.cache.hit ? 'secondary' : 'outline'}>
              缓存：{metrics.meta.cache.hit ? '命中' : '未命中'}
            </Badge>
            {metrics.meta.cache.stale ? (
              <Badge variant="destructive">Stale Fallback</Badge>
            ) : null}
            <Badge variant="outline">TTL {metrics.meta.cache.ttlSeconds}s</Badge>
            <Badge variant="outline">查询耗时 {metrics.meta.queryDurationMs}ms</Badge>
            <span>更新时间：{formatDateTime(metrics.generatedAt, locale)}</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  用户规模
                </CardTitle>
                <CardDescription>累计与新增趋势</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricKpi title="累计用户" value={numberFormatter.format(metrics.users.total)} />
                <MetricKpi title="今日新增" value={numberFormatter.format(metrics.users.newToday)} />
                <MetricKpi title="近 7 天新增" value={numberFormatter.format(metrics.users.newLast7Days)} />
                <MetricKpi title="近 30 天新增" value={numberFormatter.format(metrics.users.newLast30Days)} />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  文件规模
                </CardTitle>
                <CardDescription>上传量与处理质量</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricKpi title="累计文件" value={numberFormatter.format(metrics.files.total)} />
                <MetricKpi title="累计体积" value={formatBytes(metrics.files.totalSizeBytes)} />
                <MetricKpi title="成功率" value={formatPercent(metrics.files.successRate)} />
                <MetricKpi
                  title="状态分布"
                  value={`${metrics.files.statusCounts.completed}/${metrics.files.total}`}
                  hint={`queued ${metrics.files.statusCounts.queued} · processing ${metrics.files.statusCounts.processing} · failed ${metrics.files.statusCounts.failed}`}
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Token 用量（估算）
                </CardTitle>
                <CardDescription>基于聊天内容长度估算，适合趋势运营</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricKpi title="累计 Token" value={formatNumber(metrics.tokens.totalTokens)} />
                <MetricKpi title="累计 Prompt" value={formatNumber(metrics.tokens.totalPromptTokens)} />
                <MetricKpi title="1 天窗口" value={formatNumber(metrics.tokens.window1d.totalTokens)} />
                <MetricKpi title="7 天窗口" value={formatNumber(metrics.tokens.window7d.totalTokens)} />
                <MetricKpi title="30 天窗口" value={formatNumber(metrics.tokens.window30d.totalTokens)} />
                <MetricKpi title="30 天消息数" value={numberFormatter.format(metrics.tokens.window30d.messageCount)} />
              </CardContent>
            </Card>

            <LiteLLMUsageCard
              usage={liteLLMUsage}
              loading={liteLLMUsageQuery.isLoading && !liteLLMUsage}
              error={liteLLMUsageQuery.error}
              locale={locale}
            />

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  活跃与留存
                </CardTitle>
                <CardDescription>DAU / WAU / MAU 与 D1 / D7</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricKpi title="DAU" value={numberFormatter.format(metrics.activity.dau)} />
                <MetricKpi title="WAU" value={numberFormatter.format(metrics.activity.wau)} />
                <MetricKpi title="MAU" value={numberFormatter.format(metrics.activity.mau)} />
                <MetricKpi title="D1 留存" value={formatPercent(metrics.activity.retention.d1)} />
                <MetricKpi title="D7 留存" value={formatPercent(metrics.activity.retention.d7)} />
                <MetricKpi
                  title="活跃口径"
                  value="文档/笔记/聊天"
                  hint="文档创建、笔记更新、随手记更新、聊天消息"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CountTrendChart title="用户新增趋势" points={metrics.users.dailyNew} locale={locale} />
            <CountTrendChart title="文件新增趋势" points={metrics.files.dailyUploads} locale={locale} />
            <CountTrendChart title="日活趋势" points={metrics.activity.dailyActiveUsers} locale={locale} />
            <TokenTrendChart points={metrics.tokens.daily} locale={locale} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <TopUsersCard metrics={metrics} locale={locale} topUsersLimit={topUsers} />
            <RetentionCard metrics={metrics} locale={locale} />
          </div>
        </>
      ) : null}
    </div>
  )
}

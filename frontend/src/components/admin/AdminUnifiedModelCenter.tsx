'use client'

import { useMemo } from 'react'
import { AxiosError } from 'axios'
import { AdminLiteLLMModelCenter } from '@/components/admin/AdminLiteLLMModelCenter'
import { AdminModelConfigCenter } from '@/components/admin/AdminModelConfigCenter'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminLiteLLMModels } from '@/lib/hooks/use-admin-litellm-models'
import { useAdminLiteLLMUsage } from '@/lib/hooks/use-admin-metrics'
import { Database, Gauge, Server, ShieldCheck } from 'lucide-react'

const DB_ERROR_PATTERNS = ['db not connected', 'database not connected', 'connect a database']

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

function isDbConnectionError(message: string | null | undefined): boolean {
  if (!message) return false

  const normalized = message.toLowerCase()
  return DB_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function HealthStatusBadge({ healthy, label }: { healthy: boolean; label: string }) {
  return <Badge variant={healthy ? 'secondary' : 'destructive'}>{label}</Badge>
}

export function AdminUnifiedModelCenter() {
  const modelsQuery = useAdminLiteLLMModels()
  const usageQuery = useAdminLiteLLMUsage({ days: 30 })

  const modelsErrorMessage = modelsQuery.error
    ? getErrorMessage(modelsQuery.error, 'LiteLLM 模型接口调用失败')
    : null
  const usageErrorMessage = usageQuery.error
    ? getErrorMessage(usageQuery.error, 'LiteLLM 用量接口调用失败')
    : null
  const usageWarningMessage = usageQuery.data?.warning || null

  const dbDisconnected = useMemo(
    () =>
      [modelsErrorMessage, usageErrorMessage, usageWarningMessage].some((message) =>
        isDbConnectionError(message),
      ),
    [modelsErrorMessage, usageErrorMessage, usageWarningMessage],
  )

  const adminApiHealthy = Boolean(modelsQuery.data) && !modelsQuery.error
  const usageApiHealthy = Boolean(usageQuery.data?.available) && !usageQuery.error
  const policyEnabled = Boolean(modelsQuery.data?.policy?.allCapabilitiesViaLiteLLM)
  const modelCount = modelsQuery.data?.models?.length ?? 0

  const readOnlyReason =
    'LiteLLM 未连接数据库，供应商配置已切换只读。请在 LiteLLM 侧配置 DATABASE_URL、LITELLM_MASTER_KEY、STORE_MODEL_IN_DB=true 后重试。'

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">模型路由与供应商（统一视图）</h2>
        <p className="text-sm text-muted-foreground max-w-4xl">
          上层管理 capability 到 LiteLLM alias 的路由，下层维护 alias 对应的上游供应商参数。
          当 LiteLLM DB 未连接时，下层自动切换只读，避免“新建看似成功但实际不可用”。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4" />
              LiteLLM 管理接口
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthStatusBadge
              healthy={adminApiHealthy}
              label={adminApiHealthy ? 'Connected' : '异常'}
            />
            <div className="text-muted-foreground">alias 总数：{modelCount}</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              LiteLLM 数据库
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthStatusBadge
              healthy={!dbDisconnected}
              label={dbDisconnected ? 'Disconnected' : 'Connected'}
            />
            <div className="text-muted-foreground">用于模型管理与真实用量统计</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              LiteLLM 用量
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthStatusBadge
              healthy={usageApiHealthy}
              label={usageApiHealthy ? 'Available' : 'Unavailable'}
            />
            <div className="text-muted-foreground">按供应商花费/token 聚合</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              全能力策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HealthStatusBadge
              healthy={policyEnabled}
              label={policyEnabled ? 'LiteLLM Enforced' : '未强制'}
            />
            <div className="text-muted-foreground">ADMIN_FORCE_LITELLM_ONLY</div>
          </CardContent>
        </Card>
      </div>

      {dbDisconnected ? (
        <Alert variant="destructive">
          <AlertTitle>LiteLLM 数据库未连接</AlertTitle>
          <AlertDescription>
            {readOnlyReason}
            {usageWarningMessage ? (
              <span className="block mt-1 break-all">当前提示：{usageWarningMessage}</span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {modelsErrorMessage && !dbDisconnected ? (
        <Alert variant="destructive">
          <AlertTitle>LiteLLM 模型接口异常</AlertTitle>
          <AlertDescription className="break-all">{modelsErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {usageErrorMessage && !dbDisconnected ? (
        <Alert variant="destructive">
          <AlertTitle>LiteLLM 用量接口异常</AlertTitle>
          <AlertDescription className="break-all">{usageErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">能力路由层</h3>
          <p className="text-sm text-muted-foreground">
            配置 capability 的模型 alias、timeout 与 extra.headers，不直接管理上游供应商 URL/Key。
          </p>
        </div>
        <AdminModelConfigCenter showHeader={false} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">LiteLLM 供应商层</h3>
          <p className="text-sm text-muted-foreground">
            管理 alias 的上游供应商配置（model/api_base/api_key/mode/extra）。
          </p>
        </div>
        <AdminLiteLLMModelCenter
          showHeader={false}
          readOnly={dbDisconnected}
          readOnlyReason={readOnlyReason}
        />
      </section>
    </div>
  )
}

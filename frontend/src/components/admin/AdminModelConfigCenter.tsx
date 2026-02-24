'use client'

import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import {
  useAdminModelConfigAuditLogs,
  useAdminModelConfigs,
  useTestAdminModelConfig,
  useUpdateAdminModelConfig,
} from '@/lib/hooks/use-admin-model-configs'
import { useAdminLiteLLMModels } from '@/lib/hooks/use-admin-litellm-models'
import {
  AdminModelCapability,
  AdminModelConfigListItem,
  AdminModelConfigTestRequest,
} from '@/lib/types/api'
import { Clock3, RefreshCw, Save, Shield, TestTube } from 'lucide-react'

const CORE_CAPABILITIES: AdminModelCapability[] = ['chat', 'ktype', 'embedding', 'rerank', 'ocr']
const RETRIEVAL_CAPABILITIES: AdminModelCapability[] = ['query_rewrite', 'doc_routing']
const QUICKNOTE_CAPABILITIES: AdminModelCapability[] = ['quicknote_summary', 'quicknote_label', 'quicknote_chat']
const EXTENSION_CAPABILITIES: AdminModelCapability[] = ['web_parse_firecrawl', 'legacy_oneapi']

type CapabilityModelCategory = 'llm' | 'ocr_vl' | 'embedding' | 'rerank' | 'none'

type LiteLLMModelWithCategory = {
  modelName: string
  litellmModel: string
  mode?: string | null
  category?: string
}

type EditableCapabilityForm = {
  enabled: boolean
  model: string
  timeoutMs: string
}

const INITIAL_FORM: EditableCapabilityForm = {
  enabled: true,
  model: '',
  timeoutMs: '',
}

const CAPABILITY_MODEL_CATEGORY_MAP: Record<AdminModelCapability, CapabilityModelCategory> = {
  chat: 'llm',
  ktype: 'llm',
  embedding: 'embedding',
  rerank: 'rerank',
  ocr: 'ocr_vl',
  query_rewrite: 'llm',
  doc_routing: 'llm',
  quicknote_summary: 'llm',
  quicknote_label: 'llm',
  quicknote_chat: 'llm',
  web_parse_firecrawl: 'none',
  legacy_oneapi: 'llm',
}

const CAPABILITY_CATEGORY_LABEL: Record<CapabilityModelCategory, string> = {
  llm: 'LLM',
  ocr_vl: 'OCR/VL',
  embedding: 'Embedding',
  rerank: 'Rerank',
  none: '无模型路由',
}

function toEditableForm(item: AdminModelConfigListItem): EditableCapabilityForm {
  return {
    enabled: item.config.enabled,
    model: item.config.model || '',
    timeoutMs:
      typeof item.config.timeoutMs === 'number' && Number.isFinite(item.config.timeoutMs)
        ? String(item.config.timeoutMs)
        : '',
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined
    return (
      responseData?.error?.message ||
      responseData?.message ||
      error.message ||
      fallback
    )
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

function isAllowedModelCategory(required: CapabilityModelCategory, actual?: string | null): boolean {
  const normalized = (actual || '').trim().toLowerCase()

  if (required === 'none') {
    return true
  }

  if (required === 'llm') {
    return normalized === 'llm' || normalized === 'other' || normalized === ''
  }

  return normalized === required
}

function summarizeChangedFields(value: Record<string, unknown>): string {
  const keys = Object.keys(value || {})
  if (keys.length === 0) {
    return '无字段变更详情'
  }
  if (keys.length <= 4) {
    return keys.join('、')
  }
  return `${keys.slice(0, 4).join('、')} 等 ${keys.length} 项`
}

function parseCooldownSecondsFromMessage(message: string): number | null {
  const matched = message.match(/Try again in\s+(\d+(?:\.\d+)?)\s+seconds/i)
  if (!matched) {
    return null
  }

  const value = Number.parseFloat(matched[1])
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.ceil(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

type AdminModelConfigCenterProps = {
  showHeader?: boolean
}

export function AdminModelConfigCenter({ showHeader = true }: AdminModelConfigCenterProps) {
  const { toast } = useToast()

  const {
    data: modelConfigs,
    isLoading: isModelConfigsLoading,
    error: modelConfigsError,
    refetch: refetchModelConfigs,
    isFetching: isModelConfigsFetching,
  } = useAdminModelConfigs()
  const liteLLMModelsQuery = useAdminLiteLLMModels()
  const auditLogsQuery = useAdminModelConfigAuditLogs(20)
  const updateMutation = useUpdateAdminModelConfig()
  const testMutation = useTestAdminModelConfig()

  const [selectedCapability, setSelectedCapability] = useState<AdminModelCapability | null>(null)
  const [formStateByCapability, setFormStateByCapability] = useState<
    Partial<Record<AdminModelCapability, EditableCapabilityForm>>
  >({})
  const [testResultByCapability, setTestResultByCapability] = useState<
    Partial<Record<AdminModelCapability, { ok: boolean; message: string }>>
  >({})

  const capabilityItems = useMemo(() => modelConfigs?.capabilities || [], [modelConfigs])
  const capabilityMap = useMemo(() => {
    const map = new Map<AdminModelCapability, AdminModelConfigListItem>()
    for (const item of capabilityItems) {
      map.set(item.capability, item)
    }
    return map
  }, [capabilityItems])

  const activeCapability = useMemo<AdminModelCapability | null>(() => {
    if (selectedCapability && capabilityMap.has(selectedCapability)) {
      return selectedCapability
    }

    return capabilityItems[0]?.capability ?? null
  }, [selectedCapability, capabilityMap, capabilityItems])

  const selectedCapabilityItem = activeCapability ? capabilityMap.get(activeCapability) : undefined

  const formState = useMemo(() => {
    if (!activeCapability) {
      return INITIAL_FORM
    }

    const existing = formStateByCapability[activeCapability]
    if (existing) {
      return existing
    }

    if (selectedCapabilityItem) {
      return toEditableForm(selectedCapabilityItem)
    }

    return INITIAL_FORM
  }, [formStateByCapability, activeCapability, selectedCapabilityItem])

  const activeTestResult = activeCapability ? testResultByCapability[activeCapability] : undefined

  const capabilitySections: Array<{ key: string; title: string; capabilities: AdminModelCapability[] }> = [
    { key: 'core', title: '核心能力', capabilities: CORE_CAPABILITIES },
    { key: 'retrieval', title: '检索增强', capabilities: RETRIEVAL_CAPABILITIES },
    { key: 'quicknote', title: 'Quick Notes', capabilities: QUICKNOTE_CAPABILITIES },
    { key: 'extension', title: '扩展能力', capabilities: EXTENSION_CAPABILITIES },
  ]

  const litellmModels = useMemo(() => {
    return (liteLLMModelsQuery.data?.models || []) as LiteLLMModelWithCategory[]
  }, [liteLLMModelsQuery.data?.models])

  const requiredCategory = activeCapability
    ? CAPABILITY_MODEL_CATEGORY_MAP[activeCapability]
    : 'none'

  const availableModelOptions = useMemo(() => {
    if (!selectedCapabilityItem?.meta.supportsModel) {
      return [] as LiteLLMModelWithCategory[]
    }

    return litellmModels
      .filter((item) => isAllowedModelCategory(requiredCategory, item.category))
      .sort((a, b) => a.modelName.localeCompare(b.modelName))
  }, [litellmModels, selectedCapabilityItem?.meta.supportsModel, requiredCategory])

  const selectedModelOption = availableModelOptions.find((item) => item.modelName === formState.model)
  const selectedModelFromAll = litellmModels.find((item) => item.modelName === formState.model)

  const isSaving = updateMutation.isPending
  const isTesting = testMutation.isPending

  const handleCapabilitySwitch = (value: string) => {
    setSelectedCapability(value as AdminModelCapability)
  }

  const handleFieldChange = <K extends keyof EditableCapabilityForm>(
    key: K,
    value: EditableCapabilityForm[K],
  ) => {
    if (!activeCapability) {
      return
    }

    setFormStateByCapability((prev) => {
      const current =
        prev[activeCapability] ||
        (selectedCapabilityItem ? toEditableForm(selectedCapabilityItem) : INITIAL_FORM)

      return {
        ...prev,
        [activeCapability]: {
          ...current,
          [key]: value,
        },
      }
    })
  }

  const handleResetFromServer = () => {
    if (!selectedCapabilityItem || !activeCapability) {
      return
    }

    setFormStateByCapability((prev) => {
      const next = { ...prev }
      delete next[activeCapability]
      return next
    })

    toast({
      title: '已重置',
      description: `已加载 ${selectedCapabilityItem.meta.label} 的最新配置。`,
    })
  }

  const parseTimeout = (value: string): number | null | undefined => {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return undefined
    }
    return parsed
  }

  const buildUpdatePayload = () => {
    if (!activeCapability || !selectedCapabilityItem) {
      return { error: '未选择能力' }
    }

    const timeoutMs = parseTimeout(formState.timeoutMs)
    if (timeoutMs === undefined) {
      return { error: 'timeoutMs 必须是非负数字' }
    }

    const supportsModel = selectedCapabilityItem.meta.supportsModel
    const normalizedModel = formState.model.trim()

    if (supportsModel && formState.enabled && !normalizedModel) {
      return { error: '能力已启用时，必须选择一个模型别名' }
    }

    return {
      payload: {
        enabled: formState.enabled,
        model: supportsModel ? (normalizedModel || null) : null,
        timeoutMs,
      },
    }
  }

  const handleSave = async () => {
    if (!activeCapability) {
      return
    }

    const built = buildUpdatePayload()
    if ('error' in built) {
      toast({
        title: '保存失败',
        description: built.error,
        variant: 'destructive',
      })
      return
    }

    try {
      await updateMutation.mutateAsync({
        capability: activeCapability,
        payload: built.payload,
      })
      toast({
        title: '保存成功',
        description: '能力路由配置已更新并写入审计日志。',
      })

      setFormStateByCapability((prev) => {
        const next = { ...prev }
        delete next[activeCapability]
        return next
      })
    } catch (error) {
      toast({
        title: '保存失败',
        description: getErrorMessage(error, '更新配置失败，请稍后重试。'),
        variant: 'destructive',
      })
    }
  }

  const handleTest = async () => {
    if (!activeCapability) {
      return
    }

    const built = buildUpdatePayload()
    if ('error' in built) {
      toast({
        title: '测试失败',
        description: built.error,
        variant: 'destructive',
      })
      return
    }

    const payload: AdminModelConfigTestRequest = {
      useSaved: false,
      override: built.payload,
    }

    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await testMutation.mutateAsync({
          capability: activeCapability,
          payload,
        })

        const resultData = result.result as { ok?: boolean; reason?: string } | undefined
        const ok = Boolean(resultData?.ok)
        const elapsed = typeof result.elapsedMs === 'number' ? `${result.elapsedMs}ms` : '--'
        const reason =
          typeof resultData?.reason === 'string' ? resultData.reason : ok ? '连接测试通过' : '连接测试失败'

        setTestResultByCapability((prev) => ({
          ...prev,
          [activeCapability]: {
            ok,
            message: `${reason}（耗时 ${elapsed}，source=${result.source}）`,
          },
        }))

        toast({
          title: ok ? '测试成功' : '测试未通过',
          description: `${reason}（${elapsed}）`,
          variant: ok ? 'default' : 'destructive',
        })

        return
      } catch (error) {
        const message = getErrorMessage(error, '测试连接失败，请检查模型映射。')
        const cooldownSeconds = parseCooldownSecondsFromMessage(message)

        if (cooldownSeconds && attempt < maxAttempts) {
          toast({
            title: '模型冷却中，自动重试',
            description: `第 ${attempt} 次失败，${cooldownSeconds} 秒后自动重试。`,
            variant: 'destructive',
          })
          await sleep(cooldownSeconds * 1000)
          continue
        }

        setTestResultByCapability((prev) => ({
          ...prev,
          [activeCapability]: {
            ok: false,
            message,
          },
        }))

        toast({
          title: '测试失败',
          description: message,
          variant: 'destructive',
        })

        return
      }
    }
  }

  const handleTestSaved = async () => {
    if (!activeCapability) {
      return
    }

    const payload: AdminModelConfigTestRequest = { useSaved: true }
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await testMutation.mutateAsync({
          capability: activeCapability,
          payload,
        })

        const resultData = result.result as { ok?: boolean; reason?: string } | undefined
        const ok = Boolean(resultData?.ok)
        const elapsed = typeof result.elapsedMs === 'number' ? `${result.elapsedMs}ms` : '--'
        const reason =
          typeof resultData?.reason === 'string' ? resultData.reason : ok ? 'Saved 配置测试通过' : 'Saved 配置测试失败'

        setTestResultByCapability((prev) => ({
          ...prev,
          [activeCapability]: {
            ok,
            message: `${reason}（耗时 ${elapsed}，source=${result.source}）`,
          },
        }))

        toast({
          title: ok ? '测试成功' : '测试未通过',
          description: `${reason}（${elapsed}）`,
          variant: ok ? 'default' : 'destructive',
        })

        return
      } catch (error) {
        const message = getErrorMessage(error, '测试 Saved 配置失败，请检查当前配置。')
        const cooldownSeconds = parseCooldownSecondsFromMessage(message)

        if (cooldownSeconds && attempt < maxAttempts) {
          toast({
            title: '模型冷却中，自动重试',
            description: `第 ${attempt} 次失败，${cooldownSeconds} 秒后自动重试。`,
            variant: 'destructive',
          })
          await sleep(cooldownSeconds * 1000)
          continue
        }

        setTestResultByCapability((prev) => ({
          ...prev,
          [activeCapability]: {
            ok: false,
            message,
          },
        }))

        toast({
          title: '测试失败',
          description: message,
          variant: 'destructive',
        })

        return
      }
    }
  }

  const renderCapabilityButton = (capability: AdminModelCapability) => {
    const item = capabilityMap.get(capability)
    if (!item) {
      return null
    }

    const isActive = activeCapability === capability
    const source = item.config.source

    return (
      <button
        key={capability}
        type="button"
        onClick={() => handleCapabilitySwitch(capability)}
        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
          isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium truncate">{item.meta.label}</div>
          <Badge variant="outline">{source}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground truncate">{item.capability}</div>
      </button>
    )
  }

  const loading = isModelConfigsLoading
  const error = modelConfigsError

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">能力路由配置中心</h2>
          <p className="text-sm text-muted-foreground max-w-4xl">
            仅维护“能力 → LiteLLM 模型别名”路由关系。供应商 URL / Key 在“模型管理”页统一维护；Prompt/extra 属于产品策略，不在运营后台开放编辑。
          </p>
        </div>
      ) : null}

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>策略隔离</AlertTitle>
        <AlertDescription>
          本页只允许修改能力启用状态、模型别名与超时；供应商连接参数与策略字段（Prompt/extra）已隔离到产品层，不可在此改动。
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {getErrorMessage(error, '能力配置加载失败，请稍后重试。')}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>能力列表</CardTitle>
              <CardDescription>选择需要调整路由的能力</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {capabilitySections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {section.title}
                  </div>
                  <div className="space-y-2">
                    {section.capabilities.map((capability) => renderCapabilityButton(capability))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{selectedCapabilityItem?.meta.label || '能力配置'}</CardTitle>
                <CardDescription>
                  {selectedCapabilityItem?.meta.description || '请选择左侧能力进行配置。'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedCapabilityItem ? (
                  <Alert>
                    <AlertTitle>未找到能力</AlertTitle>
                    <AlertDescription>当前能力不存在于返回列表，请刷新重试。</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Capability</label>
                        <Input value={selectedCapabilityItem.capability} disabled />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">模型分类约束</label>
                        <div className="h-10 rounded-md border px-3 flex items-center gap-2 bg-muted/20">
                          <Badge variant="secondary">{CAPABILITY_CATEGORY_LABEL[requiredCategory]}</Badge>
                          <span className="text-xs text-muted-foreground">仅可选择该分类的 LiteLLM 模型别名</span>
                        </div>
                      </div>

                      {selectedCapabilityItem.meta.supportsModel ? (
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">模型别名（LiteLLM model_name）</label>
                          <Select
                            value={formState.model || '__none__'}
                            onValueChange={(value) =>
                              handleFieldChange('model', value === '__none__' ? '' : value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="请选择模型别名" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">(未设置)</SelectItem>
                              {formState.model && !selectedModelOption ? (
                                <SelectItem value={formState.model}>
                                  当前值（待迁移）：{formState.model}
                                </SelectItem>
                              ) : null}
                              {availableModelOptions.map((item) => (
                                <SelectItem key={item.modelName} value={item.modelName}>
                                  {item.modelName} · {item.litellmModel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {availableModelOptions.length === 0 ? (
                            <div className="text-xs text-amber-600">
                              当前分类下暂无可选模型，请先到“模型管理”页新增 {CAPABILITY_CATEGORY_LABEL[requiredCategory]} 模型。
                            </div>
                          ) : null}

                          {formState.model && !selectedModelOption ? (
                            <div className="text-xs text-amber-600">
                              当前配置模型 `{formState.model}` 不在可选分类列表中。
                              {selectedModelFromAll
                                ? ` 已识别分类：${selectedModelFromAll.category || 'unknown'}。`
                                : ' 该别名可能已被删除。'}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">模型路由</label>
                          <Input value="该能力不使用模型路由" disabled />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Timeout (ms)</label>
                        <Input
                          value={formState.timeoutMs}
                          onChange={(event) => handleFieldChange('timeoutMs', event.target.value)}
                          placeholder="20000"
                          disabled={!selectedCapabilityItem.meta.supportsTimeout}
                        />
                      </div>

                      <div className="flex items-center gap-3 md:pt-7">
                        <Checkbox
                          checked={formState.enabled}
                          onCheckedChange={(checked) => handleFieldChange('enabled', checked === true)}
                          id="capability-enabled"
                        />
                        <label htmlFor="capability-enabled" className="text-sm font-medium">
                          启用该能力
                        </label>
                        <Badge variant="outline">source={selectedCapabilityItem.config.source}</Badge>
                      </div>
                    </div>

                    {activeTestResult ? (
                      <Alert variant={activeTestResult.ok ? 'default' : 'destructive'}>
                        <AlertTitle>
                          {activeTestResult.ok ? '连接测试通过' : '连接测试失败'}
                        </AlertTitle>
                        <AlertDescription>{activeTestResult.message}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleTest}
                        disabled={isTesting || isSaving}
                        variant="secondary"
                      >
                        {isTesting ? (
                          <>
                            <LoadingSpinner size="sm" />
                            测试中...
                          </>
                        ) : (
                          <>
                            <TestTube className="h-4 w-4" />
                            测试连接
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || isTesting}
                      >
                        {isSaving ? (
                          <>
                            <LoadingSpinner size="sm" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            保存配置
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetFromServer}
                        disabled={isSaving || isTesting}
                      >
                        重置表单
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestSaved}
                        disabled={isTesting || isSaving}
                      >
                        {isTesting ? (
                          <>
                            <LoadingSpinner size="sm" />
                            测试中...
                          </>
                        ) : (
                          <>
                            <TestTube className="h-4 w-4" />
                            测试 Saved 配置
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => Promise.allSettled([
                          refetchModelConfigs(),
                          liteLLMModelsQuery.refetch(),
                          auditLogsQuery.refetch(),
                        ])}
                        disabled={isModelConfigsFetching || isSaving || isTesting}
                      >
                        {isModelConfigsFetching ? (
                          <>
                            <LoadingSpinner size="sm" />
                            刷新中...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            刷新列表
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  最近审计日志
                </CardTitle>
                <CardDescription>展示能力路由最近 20 条 create / update / test 记录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {auditLogsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">加载中...</div>
                ) : auditLogsQuery.error ? (
                  <div className="text-sm text-red-500">
                    {getErrorMessage(auditLogsQuery.error, '审计日志加载失败')}
                  </div>
                ) : (auditLogsQuery.data?.logs || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无审计记录</div>
                ) : (
                  auditLogsQuery.data!.logs.map((log) => {
                    const capabilityLabel = capabilityMap.get(log.capability)?.meta.label || log.capability
                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border border-border/70 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {capabilityLabel}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{log.action}</Badge>
                            <span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          操作人：{log.operatorEmail || log.operatorUserId || 'system'} · 字段：{summarizeChangedFields(log.changedFields)}
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAdminLiteLLMModels,
  useCreateAdminLiteLLMModel,
  useDeleteAdminLiteLLMModel,
  useUpdateAdminLiteLLMModel,
} from '@/lib/hooks/use-admin-litellm-models'
import { adminLiteLLMModelsApi } from '@/lib/api/admin-litellm-models'
import { useToast } from '@/lib/hooks/use-toast'
import { type AdminLiteLLMModelItem } from '@/lib/types/api'
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'

type ModelFormState = {
  modelName: string
  litellmModel: string
  apiBase: string
  apiKey: string
  mode: string
}

type DraftModelState = {
  draftId: string
  modelName: string
  litellmModel: string
  mode: string
}

type ModelListItem = {
  key: string
  modelName: string
  litellmModel: string
  mode: string | null
  isDraft: boolean
}

const EMPTY_FORM: ModelFormState = {
  modelName: '',
  litellmModel: '',
  apiBase: '',
  apiKey: '',
  mode: '',
}

function toFormState(item: AdminLiteLLMModelItem): ModelFormState {
  return {
    modelName: item.modelName,
    litellmModel: item.litellmModel,
    apiBase: item.apiBase || '',
    apiKey: '',
    mode: item.mode || '',
  }
}

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

type AdminLiteLLMModelCenterProps = {
  showHeader?: boolean
  readOnly?: boolean
  readOnlyReason?: string
}

export function AdminLiteLLMModelCenter({
  showHeader = true,
  readOnly = false,
  readOnlyReason,
}: AdminLiteLLMModelCenterProps) {
  const { toast } = useToast()

  const listQuery = useAdminLiteLLMModels()
  const createMutation = useCreateAdminLiteLLMModel()
  const updateMutation = useUpdateAdminLiteLLMModel()
  const deleteMutation = useDeleteAdminLiteLLMModel()

  const models = useMemo(() => listQuery.data?.models ?? [], [listQuery.data?.models])
  const policy = listQuery.data?.policy

  const [selectedItemKey, setSelectedItemKey] = useState<string>('')
  const [formState, setFormState] = useState<ModelFormState>(EMPTY_FORM)
  const [draftModel, setDraftModel] = useState<DraftModelState | null>(null)
  const [showPlainApiKey, setShowPlainApiKey] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null)
  const [currentApiKeySource, setCurrentApiKeySource] = useState<'table' | 'env' | null>(null)
  const [currentApiKeyEnvVar, setCurrentApiKeyEnvVar] = useState<string | null>(null)
  const [isLoadingCurrentApiKey, setIsLoadingCurrentApiKey] = useState(false)
  const [pendingClearApiKey, setPendingClearApiKey] = useState(false)

  const isDraftSelected = Boolean(draftModel && selectedItemKey === draftModel.draftId)

  const selectedModel = useMemo(
    () => models.find((item) => item.modelName === selectedItemKey),
    [models, selectedItemKey],
  )

  const hasTypedApiKey = formState.apiKey.trim().length > 0

  const modelList = useMemo<ModelListItem[]>(() => {
    const nextList: ModelListItem[] = models.map((item) => ({
      key: item.modelName,
      modelName: item.modelName,
      litellmModel: item.litellmModel,
      mode: item.mode,
      isDraft: false,
    }))

    if (!draftModel) {
      return nextList
    }

    return [
      {
        key: draftModel.draftId,
        modelName: draftModel.modelName.trim() || '未命名模型',
        litellmModel: draftModel.litellmModel.trim() || '保存后将写入 LiteLLM',
        mode: draftModel.mode.trim() || null,
        isDraft: true,
      },
      ...nextList,
    ]
  }, [models, draftModel])

  const isExistingModel = Boolean(selectedModel)
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const controlsDisabled = readOnly || isBusy
  const readOnlyMessage =
    readOnlyReason || 'LiteLLM 当前未连接数据库，供应商配置中心已切换为只读。'
  const formCardTitle =
    isExistingModel && selectedModel
      ? `编辑：${selectedModel.modelName}`
      : isDraftSelected
        ? '新建 LiteLLM 模型别名（草稿）'
        : '新建 LiteLLM 模型别名'

  useEffect(() => {
    let cancelled = false

    const applyState = (nextModelName: string, nextFormState: ModelFormState) => {
      Promise.resolve().then(() => {
        if (cancelled) {
          return
        }

        setSelectedItemKey(nextModelName)
        setFormState(nextFormState)
      })
    }

    if (isDraftSelected) {
      return () => {
        cancelled = true
      }
    }

    if (!models.length) {
      applyState('', EMPTY_FORM)
      return () => {
        cancelled = true
      }
    }

    if (!selectedItemKey) {
      const first = models[0]
      applyState(first.modelName, toFormState(first))
      return () => {
        cancelled = true
      }
    }

    if (!selectedModel) {
      if (listQuery.isFetching) {
        return () => {
          cancelled = true
        }
      }

      const first = models[0]
      applyState(first.modelName, toFormState(first))
      return () => {
        cancelled = true
      }
    }

    applyState(selectedModel.modelName, toFormState(selectedModel))

    return () => {
      cancelled = true
    }
  }, [models, selectedItemKey, selectedModel, isDraftSelected, listQuery.isFetching])

  useEffect(() => {
    let cancelled = false

    async function loadCurrentApiKey() {
      if (!selectedModel || !showPlainApiKey) {
        if (!cancelled) {
          setCurrentApiKey(null)
          setCurrentApiKeySource(null)
          setCurrentApiKeyEnvVar(null)
          setIsLoadingCurrentApiKey(false)
        }
        return
      }

      setIsLoadingCurrentApiKey(true)

      try {
        const secret = await adminLiteLLMModelsApi.getSecret(selectedModel.modelName)
        if (!cancelled) {
          setCurrentApiKey(secret.apiKey || null)
          setCurrentApiKeySource(secret.source ?? null)
          setCurrentApiKeyEnvVar(secret.envVar ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentApiKey(null)
          setCurrentApiKeySource(null)
          setCurrentApiKeyEnvVar(null)
          toast({
            title: '读取失败',
            description: getErrorMessage(error, '无法读取当前模型 API Key。'),
            variant: 'destructive',
          })
          setShowPlainApiKey(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCurrentApiKey(false)
        }
      }
    }

    loadCurrentApiKey()

    return () => {
      cancelled = true
    }
  }, [selectedModel, showPlainApiKey, toast])

  const handleSelectModel = (itemKey: string) => {
    setSelectedItemKey(itemKey)
    setShowPlainApiKey(false)
    setCurrentApiKey(null)
    setCurrentApiKeySource(null)
    setCurrentApiKeyEnvVar(null)
    setPendingClearApiKey(false)

    if (draftModel && itemKey === draftModel.draftId) {
      return
    }

    const item = models.find((entry) => entry.modelName === itemKey)
    if (item) {
      setFormState(toFormState(item))
    }
  }

  const handleCreateNew = () => {
    if (readOnly) {
      toast({
        title: '当前为只读模式',
        description: readOnlyMessage,
        variant: 'destructive',
      })
      return
    }

    const draftId = `draft-${Date.now()}`
    setDraftModel({ draftId, modelName: '', litellmModel: '', mode: '' })
    setSelectedItemKey(draftId)
    setFormState(EMPTY_FORM)
    setShowPlainApiKey(false)
    setCurrentApiKey(null)
    setCurrentApiKeySource(null)
    setCurrentApiKeyEnvVar(null)
    setPendingClearApiKey(false)
  }

  const handleToggleShowCurrentApiKey = () => {
    if (!selectedModel) {
      return
    }

    setShowPlainApiKey((previous) => !previous)
  }

  const handleClearApiKey = () => {
    setFormState((previous) => ({ ...previous, apiKey: '' }))
    setShowPlainApiKey(false)
    setCurrentApiKey(null)
    setCurrentApiKeySource(null)
    setCurrentApiKeyEnvVar(null)
    setPendingClearApiKey(true)

    toast({
      title: '已标记清空 Key',
      description: '点击“保存”后才会真正清空当前模型的 API Key。',
    })
  }

  const handleFormFieldChange = (key: keyof ModelFormState, value: string) => {
    setFormState((previous) => ({ ...previous, [key]: value }))

    if (key === 'apiKey' && value.trim()) {
      setPendingClearApiKey(false)
    }

    if (!isDraftSelected || !draftModel) {
      return
    }

    if (key === 'modelName' || key === 'litellmModel' || key === 'mode') {
      setDraftModel((previous) => {
        if (!previous) {
          return previous
        }

        if (key === 'modelName') {
          return { ...previous, modelName: value }
        }
        if (key === 'litellmModel') {
          return { ...previous, litellmModel: value }
        }

        return { ...previous, mode: value }
      })
    }
  }

  const handleSave = async () => {
    if (readOnly) {
      toast({
        title: '保存失败',
        description: readOnlyMessage,
        variant: 'destructive',
      })
      return
    }

    const modelName = formState.modelName.trim()
    const litellmModel = formState.litellmModel.trim()

    if (!modelName) {
      toast({ title: '保存失败', description: 'modelName 不能为空', variant: 'destructive' })
      return
    }

    if (!litellmModel) {
      toast({ title: '保存失败', description: 'litellmModel 不能为空', variant: 'destructive' })
      return
    }

    const payload = {
      modelName,
      litellmModel,
      apiBase: formState.apiBase.trim() || null,
      apiKey: hasTypedApiKey ? formState.apiKey.trim() : pendingClearApiKey ? null : undefined,
      clearApiKey: pendingClearApiKey,
      mode: formState.mode.trim() || null,
    }

    try {
      if (isExistingModel && selectedModel) {
        await updateMutation.mutateAsync({ modelName: selectedModel.modelName, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }

      const refreshResult = await listQuery.refetch()
      const refreshedModels = refreshResult.data?.models ?? []
      const nextSelectedModel = refreshedModels.find((item) => item.modelName === modelName)

      setDraftModel(null)
      setPendingClearApiKey(false)

      if (nextSelectedModel) {
        setSelectedItemKey(nextSelectedModel.modelName)
        setFormState(toFormState(nextSelectedModel))
        setShowPlainApiKey(false)
        setCurrentApiKey(null)
        setCurrentApiKeySource(null)
        setCurrentApiKeyEnvVar(null)
      } else if (refreshedModels.length > 0) {
        const fallbackModel = refreshedModels[0]
        setSelectedItemKey(fallbackModel.modelName)
        setFormState(toFormState(fallbackModel))
        setShowPlainApiKey(false)
        setCurrentApiKey(null)
        setCurrentApiKeySource(null)
        setCurrentApiKeyEnvVar(null)
      } else {
        setSelectedItemKey('')
        setFormState(EMPTY_FORM)
        setShowPlainApiKey(false)
        setCurrentApiKey(null)
        setCurrentApiKeySource(null)
        setCurrentApiKeyEnvVar(null)
      }

      toast({
        title: '保存成功',
        description: 'LiteLLM 模型配置已更新',
      })
    } catch (error) {
      toast({
        title: '保存失败',
        description: getErrorMessage(error, 'LiteLLM 模型配置保存失败'),
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (readOnly) {
      toast({
        title: '删除失败',
        description: readOnlyMessage,
        variant: 'destructive',
      })
      return
    }

    if (isDraftSelected && draftModel) {
      setDraftModel(null)
      setSelectedItemKey('')
      setFormState(EMPTY_FORM)
      setShowPlainApiKey(false)
      setCurrentApiKey(null)
      setCurrentApiKeySource(null)
      setCurrentApiKeyEnvVar(null)
      toast({ title: '已取消', description: '已移除未保存的新建草稿。' })
      return
    }

    if (!selectedModel) {
      return
    }

    const confirmed = window.confirm(`确认删除 LiteLLM 模型别名：${selectedModel.modelName} ?`)
    if (!confirmed) return

    try {
      await deleteMutation.mutateAsync(selectedModel.modelName)
      await listQuery.refetch()
      setSelectedItemKey('')
      setShowPlainApiKey(false)
      setCurrentApiKey(null)
      setCurrentApiKeySource(null)
      setCurrentApiKeyEnvVar(null)
      setPendingClearApiKey(false)
      toast({ title: '删除成功', description: 'LiteLLM 模型别名已删除' })
    } catch (error) {
      toast({
        title: '删除失败',
        description: getErrorMessage(error, '删除 LiteLLM 模型失败'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">LiteLLM 模型与供应商配置</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            统一维护 LiteLLM model alias → 上游供应商映射。所有 capability 强制走 LiteLLM 网关。
          </p>
        </div>
      ) : null}

      <Alert>
        <AlertTitle>策略状态</AlertTitle>
        <AlertDescription>
          全能力 LiteLLM 网关路由：
          <strong>{policy?.allCapabilitiesViaLiteLLM ? '已启用' : '未启用'}</strong>
          。修改后请先点击保存，再回到能力配置页切换 model alias。
        </AlertDescription>
      </Alert>

      {readOnly ? (
        <Alert variant="destructive">
          <AlertTitle>当前为只读模式</AlertTitle>
          <AlertDescription>{readOnlyMessage}</AlertDescription>
        </Alert>
      ) : null}

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : listQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {getErrorMessage(listQuery.error, '加载 LiteLLM 模型配置失败')}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>LiteLLM 模型列表</CardTitle>
              <CardDescription>建议按 capability 使用统一 alias 进行路由</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleCreateNew} disabled={controlsDisabled}>
                  <Plus className="h-4 w-4" />
                  新建模型别名
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={listQuery.isFetching}
                  onClick={() => listQuery.refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新
                </Button>
              </div>

              <div className="space-y-2">
                {modelList.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无模型配置</div>
                ) : (
                  modelList.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleSelectModel(item.key)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedItemKey === item.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">{item.modelName}</div>
                        <div className="flex items-center gap-1">
                          {item.isDraft ? <Badge variant="secondary">草稿</Badge> : null}
                          {item.mode ? <Badge variant="outline">{item.mode}</Badge> : null}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {item.litellmModel}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{formCardTitle}</CardTitle>
              <CardDescription>
                填写 LiteLLM 接口所需的 model_name、litellm_params 与可选 mode。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model Alias（model_name）</label>
                  <Input
                    value={formState.modelName}
                    onChange={(event) => handleFormFieldChange('modelName', event.target.value)}
                    placeholder="qwen-flash"
                    disabled={isExistingModel || readOnly}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">LiteLLM Model（litellm_params.model）</label>
                  <Input
                    value={formState.litellmModel}
                    onChange={(event) => handleFormFieldChange('litellmModel', event.target.value)}
                    placeholder="openai/qwen-flash"
                    disabled={readOnly}
                  />
                  <div className="text-xs text-muted-foreground">
                    如填写供应商模型 ID（例如 Pro/moonshotai/Kimi-K2.5），保存时会自动补全为 openai/ 前缀。
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">API Base（litellm_params.api_base）</label>
                  <Input
                    value={formState.apiBase}
                    onChange={(event) => handleFormFieldChange('apiBase', event.target.value)}
                    placeholder="https://api.siliconflow.cn/v1"
                    disabled={readOnly}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">API Key（litellm_params.api_key）</label>
                  <Input
                    type={showPlainApiKey ? 'text' : 'password'}
                    value={formState.apiKey}
                    onChange={(event) => handleFormFieldChange('apiKey', event.target.value)}
                    placeholder={selectedModel?.apiKeyMasked || '请输入 API Key（可留空）'}
                    disabled={readOnly}
                  />
                  <div className="text-xs text-muted-foreground">
                    当前掩码：{selectedModel?.apiKeyMasked || '未配置'}
                  </div>
                  {pendingClearApiKey ? (
                    <div className="text-xs text-amber-600">已标记清空，保存后会删除当前 Key。</div>
                  ) : null}
                  {isExistingModel && selectedModel ? (
                    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">
                        当前已保存 Key：
                        {showPlainApiKey
                          ? isLoadingCurrentApiKey
                            ? '读取中...'
                            : currentApiKey || '未配置'
                          : selectedModel.apiKeyMasked || '未配置'}
                      </div>
                      {showPlainApiKey ? (
                        <div className="text-xs text-muted-foreground">
                          Key 来源：
                          {currentApiKeySource === 'table'
                            ? '密钥表'
                            : currentApiKeySource === 'env'
                              ? `环境变量（${currentApiKeyEnvVar || '未识别'}）`
                              : '未知'}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleToggleShowCurrentApiKey}
                          disabled={readOnly || isLoadingCurrentApiKey}
                        >
                          {showPlainApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showPlainApiKey ? '隐藏当前 Key' : '查看当前 Key'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleClearApiKey}
                          disabled={readOnly}
                        >
                          <KeyRound className="h-4 w-4" />
                          清空并保存 Key
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode（model_info.mode）</label>
                  <Select
                    value={formState.mode || 'none'}
                    onValueChange={(value) => handleFormFieldChange('mode', value === 'none' ? '' : value)}
                    disabled={readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择 mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">(none)</SelectItem>
                      <SelectItem value="chat">chat</SelectItem>
                      <SelectItem value="embedding">embedding</SelectItem>
                      <SelectItem value="rerank">rerank</SelectItem>
                      <SelectItem value="image">image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={handleSave} disabled={controlsDisabled}>
                  {isBusy ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />}
                  保存
                </Button>

                <Button type="button" variant="outline" onClick={handleCreateNew} disabled={controlsDisabled}>
                  <Plus className="h-4 w-4" />
                  新建
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={readOnly || (!isExistingModel && !isDraftSelected) || isBusy}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDraftSelected ? '取消草稿' : '删除'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

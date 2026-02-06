// K-Type 处理流程（LiteLLM 版本）
// 兼容层：对外保持旧的导出名称，内部使用新版实现

export {
  processKTypeWorkflowEfficient as processKTypeWorkflow,
  processKTypeWorkflowEfficientWithFallback as processKTypeWorkflowWithFallback,
  type KTypeProcessResult,
} from './k-type-efficient-vercel'

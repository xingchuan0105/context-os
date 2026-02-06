#!/usr/bin/env tsx
/**
 * LLM 模型性能对比脚本
 * 对比 DeepSeek 直连、SiliconFlow DeepSeek、千问 Qwen 的性能和质量
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { compareModels, getModelConfigs, type StreamEvent, type ModelComparisonResult } from '../lib/llm-client'

// 测试用文档
const TEST_DOCUMENT = `
# 人工智能在医疗领域的应用与挑战

## 引言

人工智能（AI）技术正在深刻改变医疗健康���业。从辅助诊断到个性化治疗，从药物研发到医院管理，AI的应用场景日益广泛。本文将全面分析AI在医疗领域的核心应用、技术实现、面临的挑战以及未来发展方向。

## 第一章：AI在医疗诊断中的应用

### 1.1 医学影像分析

医学影像是AI在医疗领域最成熟的应用之一。深度学习模型，特别是卷积神经网络（CNN），在以下任务中表现出色：

- **肺癌筛查**: CT影像中的结节检测，灵敏度可达95%以上
- **糖尿病视网膜病变**: 通过眼底照片识别微血管异常
- **皮肤癌诊断**: 识别良性与恶性病变，准确率媲美皮肤科医生
- **心脏超声分析**: 自动测量心室容积和射血分数

### 1.2 病理诊断

数字病理学结合AI可以实现：
- 全切片图像（WSI）的自动分析
- 癌细胞计数和分级
- 预后标志物的定量评估

### 1.3 实验室检验结果解读

机器学习模型可以：
- 综合分析多项检验指标
- 识别复杂的异常模式
- 预测疾病风险

## 第二章：AI在药物研发中的应用

### 2.1 药物分子设计

生成式AI模型（如变分自编码器、生成对抗网络）可以：
- 生成符合药代动力学性质的分子结构
- 预测分子与靶点的结合亲和力
- 优化先导化合物

### 2.2 药物重定位

利用知识图谱和图神经网络：
- 发现老药的新适应症
- 缩短研发周期
- 降低研发成本

### 2.3 临床试验优化

AI可以：
- 优化患者招募策略
- 预测临床试验成功率
- 实时监控安全性数据

## 第三章：AI在精准医疗中的应用

### 3.1 基因组学分析

- **变异解读**: 识别致病性基因变异
- **多基因风险评分**: 综合评估疾病遗传风险
- **药物基因组学**: 预测药物反应和不良反应

### 3.2 治疗方案个性化

- 基于患者特征推荐最优治疗方案
- 动态调整药物剂量
- 预测治疗响应

## 第四章：技术实现与挑战

### 4.1 数据质量与标准化

医疗数据的特点：
- 数据孤岛现象严重
- 标准化程度低（HL7、FHIR等标准推广不足）
- 数据标注成本高昂
- 隐私保护要求严格

### 4.2 模型可解释性

医疗AI的关键挑战：
- 黑盒模型难以获得医生信任
- 需要提供临床可解释的决策依据
- 符合监管要求（如FDA的算法透明度要求）

### 4.3 泛化能力

- 模型在不同医院、设备上的性能差异
- 跨种族、跨地域的适应性
- 对抗分布外（OOD）数据的能力

## 第五章：伦理与监管挑战

### 5.1 数据隐私

- 符合GDPR、HIPAA等法规
- 联邦学习作为隐私保护方案
- 数据去标识化的有效性

### 5.2 算法公平性

- 避免对特定人群的偏见
- 确保医疗资源的公平分配
- 透明度和问责制

### 5.3 责任认定

- AI决策失误的责任归属
- 医生与AI的协同决策模式
- 保险与法律框架

## 第六章：未来展望

### 6.1 多模态AI

融合影像、文本、基因组、生理信号等多源数据

### 6.2 因果推断

从相关性分析转向因果性理解

### 6.3 人机协同

AI作为医生的"第二意见"和决策支持工具

### 6.4 持续学习

模型在临床实践中的持续优化和更新

## 结论

AI在医疗领域的应用前景广阔，但也面临数据、技术、伦理等多重挑战。未来需要医疗机构、技术公司、监管部门的密切合作，推动负责任的AI医疗创新。

关键要点：
1. AI在影像诊断、药物研发、精准医疗等领域已取得显著成果
2. 数据质量、模型可解释性、泛化能力是主要技术挑战
3. 隐私保护、算法公平性、责任认定是重要的伦理问题
4. 多模态融合、因果推断、人机协同是未来发展方向
5. 负责任的创新需要在技术进步和风险管控之间取得平衡
`.trim()

// K-Type 分析 prompt
const K_TYPE_ANALYSIS_PROMPT = `你是文档认知分析专家。请对文档进行快速分析，直接返回 JSON 结果。

请严格按照以下 JSON 格式输出：
{
  "classification": {
    "scores": {
      "procedural": 数字(0-10),
      "conceptual": 数字(0-10),
      "reasoning": 数字(0-10),
      "systemic": 数字(0-10),
      "narrative": 数字(0-10)
    },
    "dominant_types": ["类型1", "类型2"],
    "reason": "判断理由"
  },
  "scan_trace": {
    "dikw_level": "Data/Information/Knowledge/Wisdom",
    "tacit_explicit_ratio": "比例",
    "logic_pattern": "模式描述",
    "evidence": ["证据1", "证据2"]
  },
  "knowledge_modules": [
    {
      "type": "procedural|conceptual|reasoning|systemic|narrative",
      "score": 数字(0-10),
      "core_value": "核心价值",
      "content": "结构化内容",
      "evidence": ["证据"],
      "source_preview": "原文预览"
    }
  ],
  "executive_summary": "200-300字的执行摘要",
  "distilled_content": "精华摘要(Markdown格式)"
}

请分析以下文档：`

/**
 * 打印流式事件
 */
function printStreamEvent(model: string, event: StreamEvent) {
  switch (event.type) {
    case 'start':
      process.stdout.write(`  [${model}] 开始请求...\n`)
      break
    case 'delta':
      if (event.content !== '[FIRST_TOKEN]') {
        process.stdout.write('.') // 简单显示进度
      }
      break
    case 'rate_limit':
      process.stdout.write(`\n  ⚠️  ${event.info}\n`)
      break
    case 'error':
      process.stdout.write(`\n  ❌ 错误: ${event.error}\n`)
      break
    case 'end':
      const m = event.metrics
      process.stdout.write(`\n  ✅ 完成\n`)
      break
  }
}

/**
 * 格式化时间
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * 打印对比结果
 */
function printComparisonResults(results: ModelComparisonResult[]) {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                        模型对比结果                                   ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')

  // 性能对比表
  console.log('\n📊 性能对比:')
  console.log('┌────────────────────────────────┬──────────────┬──────────────┬──────────────┐')
  console.log('│ 模型                            │ 总耗时       │ 首字时间     │ 速度         │')
  console.log('├────────────────────────────────┼──────────────┼──────────────┼──────────────┤')

  for (const result of results) {
    if (result.error) {
      console.log(`│ ${result.model.padEnd(30)} │ ❌ 失败     │              │              │`)
    } else {
      const duration = formatTime(result.duration).padStart(12)
      const firstToken = result.metrics ? formatTime(result.metrics.firstTokenTime).padStart(12) : 'N/A'.padStart(12)
      const speed = result.metrics ? `${result.metrics.tokensPerSecond.toFixed(1)} t/s`.padStart(12) : 'N/A'.padStart(12)
      console.log(`│ ${result.model.padEnd(30)} │ ${duration} │ ${firstToken} │ ${speed} │`)
    }
  }
  console.log('└────────────────────────────────┴──────────────┴──────────────┴──────────────┘')

  // 限流检测
  console.log('\n🔍 限流检测:')
  for (const result of results) {
    if (result.metrics && result.metrics.rateLimitDetected) {
      console.log(`  ⚠️  ${result.model}: 检测到限流!`)
      if (result.metrics.rateLimitEvents.length > 0) {
        result.metrics.rateLimitEvents.forEach(e => console.log(`     - ${e}`))
      }
      console.log(`     平均间隔: ${result.metrics.avgChunkInterval.toFixed(0)}ms`)
    } else if (!result.error) {
      console.log(`  ✅ ${result.model}: 无限流问题`)
    }
  }

  // 质量对比 - 解析并展示分析结果
  console.log('\n📋 质量对比 (解析结果):')

  for (const result of results) {
    if (result.error) continue

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📦 ${result.model}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      // 尝试解析 JSON
      let jsonStr = result.content
      // 清理可能的 markdown 代码块标记
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      // 分类评分
      if (parsed.classification) {
        console.log('\n📊 分类评分:')
        const scores = parsed.classification.scores || {}
        for (const [key, value] of Object.entries(scores)) {
          const bar = '█'.repeat(Math.round(Number(value) / 2))
          console.log(`  ${key.padEnd(12)} ${String(value).padStart(3)}/10  ${bar}`)
        }
        console.log(`  主导类型: ${parsed.classification.dominant_types?.join(', ') || 'N/A'}`)
        console.log(`  判断理由: ${parsed.classification.reason || 'N/A'}`)
      }

      // DIKW 扫描
      if (parsed.scan_trace) {
        console.log('\n🔍 DIKW 扫描:')
        console.log(`  层级: ${parsed.scan_trace.dikw_level || 'N/A'}`)
        console.log(`  隐性/显性比: ${parsed.scan_trace.tacit_explicit_ratio || 'N/A'}`)
        console.log(`  逻辑模式: ${parsed.scan_trace.logic_pattern || 'N/A'}`)
      }

      // 执行摘要
      if (parsed.executive_summary) {
        console.log('\n📝 执行摘要:')
        console.log(`  ${parsed.executive_summary}`)
      }

      // 知识模块数量
      if (parsed.knowledge_modules) {
        console.log(`\n🧠 知识模块: ${parsed.knowledge_modules.length} 个`)
      }

    } catch (e) {
      console.log(`  ⚠️  无法解析 JSON 结果`)
      console.log(`  原始内容预览: ${result.content.slice(0, 200)}...`)
    }
  }

  // 完整内容输出
  console.log('\n\n╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                       完整解析结果                                    ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')

  for (const result of results) {
    if (result.error) continue

    console.log(`\n${'='.repeat(80)}`)
    console.log(`📦 ${result.model}`)
    console.log('='.repeat(80))
    console.log(result.content)
    console.log()
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                   LLM 模型性能与质量对比                             ║')
  console.log('╠════════════════════════════════════════════════════════════════════╣')
  console.log('║                                                                      ║')
  console.log('║ 对比模型:                                                            ║')
  console.log('║   1. DeepSeek (直连)                                                 ║')
  console.log('║   2. SiliconFlow DeepSeek-V3                                        ║')
  console.log('║   3. Qwen3-Max (千问)                                               ║')
  console.log('║                                                                      ║')
  console.log('║ 测试内容: K-Type 文档认知分析                                        ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')

  // 检查环境变量
  console.log('\n🔧 检查模型配置:')
  for (const [key, config] of Object.entries(getModelConfigs())) {
    const hasKey = config.apiKey ? '✅' : '❌'
    console.log(`  ${hasKey} ${config.name}: ${config.model}`)
  }

  const prompt = K_TYPE_ANALYSIS_PROMPT + '\n\n' + TEST_DOCUMENT

  console.log('\n📄 测试文档长度:', TEST_DOCUMENT.length, '字符')
  console.log('\n🔄 开始对比测试 (使用流式请求检测限流)...')

  const results = await compareModels(prompt, ['deepseek', 'siliconflow_deepseek_pro', 'qwen_max'], {
    useStream: true,
    systemPrompt: '你是文档认知分析专家。请对文档进行快速分析，直接返回 JSON 结果。',
    temperature: 0.3,
    onProgress: (model, event) => {
      printStreamEvent(model, event)
    },
  })

  printComparisonResults(results)

  // 总结
  console.log('\n╔════════════════════════════════════════════════════════════════════╗')
  console.log('║                               总结                                   ║')
  console.log('╠════════════════════════════════════════════════════════════════════╣')

  const successful = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  console.log(`\n✅ 成功完成: ${successful.length} 个模型`)
  console.log(`❌ 失败: ${failed.length} 个模型`)

  if (failed.length > 0) {
    console.log('\n失败模型:')
    failed.forEach(r => {
      console.log(`  - ${r.model}: ${r.error}`)
    })
  }

  // 性能排名
  const sortedBySpeed = [...successful].sort((a, b) => a.duration - b.duration)
  console.log('\n🏆 速度排名 (从快到慢):')
  sortedBySpeed.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  '
    console.log(`  ${medal} ${r.model}: ${formatTime(r.duration)}`)
  })

  // 限流警告
  const rateLimited = successful.filter(r => r.metrics?.rateLimitDetected)
  if (rateLimited.length > 0) {
    console.log('\n⚠️  检测到限流的模型:')
    rateLimited.forEach(r => {
      console.log(`  - ${r.model}`)
    })
    console.log('\n💡 建议: 遇到限流时，可以:')
    console.log('  1. 使用其他模型服务商')
    console.log('  2. 添加请求重试机制')
    console.log('  3. 降低请求频率')
  } else {
    console.log('\n✅ 所有模型均无检测到限流问题')
  }

  console.log('\n╚════════════════════════════════════════════════════════════════════╝')
}

main().catch(console.error)

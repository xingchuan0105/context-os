import { readFile } from 'fs/promises'
import { createClient } from '../llm'
import OpenAI from 'openai'
import type { PageImage } from './pymupdf'

const DEFAULT_SYSTEM_PROMPT = `# Role
你是一个速记员。请快速提取 PPT 图片中的关键信息。

# Constraints
1. **速度优先**：不要写完整的句子，使用短语、关键词。
2. **纯净输出**：直接开始列出内容，不要有任何开场白（如“好的，分析如下”）。
3. **符号化**：逻辑关系用符号表示（A -> B）。
4. **所见即所得**：按视觉区域提取文字。

# Output Format (Markdown)
请严格按以下三段式输出：

## 1. 视觉扫描 (OCR + Layout)
* **[位置]**: 提取的文字内容 | 提取的文字内容
* **[位置]**: 提取的文字内容...

## 2. 逻辑链
* 使用箭头符号描述关系 (例如: 现状 -> 挑战 -> 对策)

## 3. 核心结论

# Context
Slide Title: [插入标题]`
const DEFAULT_PROMPT = '请严格按三段式输出。'

async function buildImageUrl(page: PageImage): Promise<string> {
  if (page.dataUrl) {
    return page.dataUrl
  }
  if (page.filePath) {
    const data = await readFile(page.filePath)
    const mimeType = page.mimeType || 'image/png'
    return `data:${mimeType};base64,${data.toString('base64')}`
  }
  throw new Error(`Missing OCR image payload for page ${page.page}`)
}

export async function runVisionOcr(pages: PageImage[]): Promise<string> {
  const baseURL =
    process.env.VISION_OCR_BASE_URL ||
    process.env.LITELLM_BASE_URL ||
    process.env.SILICONFLOW_BASE_URL ||
    'https://api.siliconflow.cn/v1'
  const apiKey =
    process.env.VISION_OCR_API_KEY ||
    process.env.LITELLM_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    ''
  const model = process.env.VISION_OCR_MODEL || 'deepseek-ocr'
  const prompt = process.env.VISION_OCR_PROMPT || DEFAULT_PROMPT
  const systemPrompt = process.env.VISION_OCR_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT
  const useRawBaseUrl = process.env.VISION_OCR_BASE_URL_RAW === 'true'

  if (!apiKey) {
    throw new Error('未配置视觉 OCR API Key（VISION_OCR_API_KEY / LITELLM_API_KEY / SILICONFLOW_API_KEY）')
  }

  const startedAt = Date.now()
  console.log(
    `[OCR] start model=${model} pages=${pages.length} system=${systemPrompt ? 'on' : 'off'} ts=${new Date().toISOString()}`
  )

  const client = useRawBaseUrl
    ? new OpenAI({ apiKey, baseURL })
    : (createClient({ apiKey, baseURL }) as any)

  const chunks: string[] = []
  for (const page of pages) {
    const pageStart = Date.now()
    console.log(`[OCR] page=${page.page} request start ts=${new Date().toISOString()}`)
    const imageUrl = await buildImageUrl(page)
    const resp = await client.chat.completions.create({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    })
    console.log(`[OCR] page=${page.page} request done ms=${Date.now() - pageStart}`)
    const text = resp.choices?.[0]?.message?.content || ''
    chunks.push(`## 第 ${page.page} 页\n\n${text}\n`)
  }

  console.log(`[OCR] done pages=${pages.length} ms=${Date.now() - startedAt}`)
  return chunks.join('\n')
}

export async function runVisionOcrStream(
  pages: AsyncIterable<PageImage>,
  totalPages?: number
): Promise<string> {
  const baseURL =
    process.env.VISION_OCR_BASE_URL ||
    process.env.LITELLM_BASE_URL ||
    process.env.SILICONFLOW_BASE_URL ||
    'https://api.siliconflow.cn/v1'
  const apiKey =
    process.env.VISION_OCR_API_KEY ||
    process.env.LITELLM_API_KEY ||
    process.env.SILICONFLOW_API_KEY ||
    ''
  const model = process.env.VISION_OCR_MODEL || 'deepseek-ocr'
  const prompt = process.env.VISION_OCR_PROMPT || DEFAULT_PROMPT
  const systemPrompt = process.env.VISION_OCR_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT
  const useRawBaseUrl = process.env.VISION_OCR_BASE_URL_RAW === 'true'

  if (!apiKey) {
    throw new Error('未配置视觉 OCR API Key（VISION_OCR_API_KEY / LITELLM_API_KEY / SILICONFLOW_API_KEY）')
  }

  const startedAt = Date.now()
  console.log(
    `[OCR] start model=${model} pages=${typeof totalPages === 'number' ? totalPages : 'stream'} system=${systemPrompt ? 'on' : 'off'} ts=${new Date().toISOString()}`
  )

  const client = useRawBaseUrl
    ? new OpenAI({ apiKey, baseURL })
    : (createClient({ apiKey, baseURL }) as any)

  const chunks: string[] = []
  let processed = 0
  for await (const page of pages) {
    const pageStart = Date.now()
    processed += 1
    console.log(`[OCR] page=${page.page} request start ts=${new Date().toISOString()}`)
    const imageUrl = await buildImageUrl(page)
    const resp = await client.chat.completions.create({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    })
    console.log(`[OCR] page=${page.page} request done ms=${Date.now() - pageStart}`)
    const text = resp.choices?.[0]?.message?.content || ''
    chunks.push(`## 第 ${page.page} 页\n\n${text}\n`)
  }

  console.log(`[OCR] done pages=${processed} ms=${Date.now() - startedAt}`)
  return chunks.join('\n')
}

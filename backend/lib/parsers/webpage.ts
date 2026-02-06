// 网页解析器 (使用 Jina Reader 或 Firecrawl)
import type { ParseResult } from './pdf'

export interface WebPageParserOptions {
  method: 'jina' | 'firecrawl'
  jinaApiKey?: string
  firecrawlApiKey?: string
}

/**
 * 使用 Jina Reader 解析网页
 * Jina Reader 提供免费的网页解析服务
 */
export async function parseWebPageWithJina(url: string): Promise<ParseResult> {
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`

  const response = await fetch(jinaUrl, {
    headers: {
      'User-Agent': 'Context-OS/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Jina Reader failed: ${response.statusText}`)
  }

  const content = await response.text()

  return {
    content,
    metadata: {
      source_url: url,
      parser: 'jina',
    },
  }
}

/**
 * 使用 Firecrawl 解析网页
 * Firecrawl 提供更强大的网页爬取能力
 */
export async function parseWebPageWithFirecrawl(
  url: string,
  apiKey: string
): Promise<ParseResult> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
    }),
  })

  if (!response.ok) {
    throw new Error(`Firecrawl failed: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    content: data.data?.markdown || data.data?.html || '',
    metadata: {
      source_url: url,
      parser: 'firecrawl',
      title: data.data?.metadata?.title,
    },
  }
}

/**
 * 统一入口：解析网页
 */
export async function parseWebPage(
  url: string,
  options: WebPageParserOptions = { method: 'jina' }
): Promise<ParseResult> {
  if (options.method === 'firecrawl') {
    if (!options.firecrawlApiKey) {
      throw new Error('Firecrawl API key is required')
    }
    return parseWebPageWithFirecrawl(url, options.firecrawlApiKey)
  }

  // 默认使用 Jina Reader（免费，无需 API key）
  return parseWebPageWithJina(url)
}

#!/usr/bin/env tsx
/**
 * 搜索 API 测试
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3007'

const userId = 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'
const kbId = 'fbe514e4-09cf-4012-aafa-9f2374eb74d7'

async function testSearch() {
  console.log('╔══════��════════════════════════════════════════════════════════╗')
  console.log('║                      搜索 API 测试                                ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  const queries = [
    'Context OS 支持什么格式?',
    'K-Type 分析的作用是什么?',
    '如何处理 PDF 文档?',
  ]

  for (const query of queries) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`查询: "${query}"`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          userId,
          kbId,
          topK: 3,
          includeParent: true,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`❌ 错误: ${response.status} - ${error}`)
        continue
      }

      const data = await response.json()

      console.log(`\n找到 ${data.total} 个结果:`)
      data.results.forEach((r: any, i: number) => {
        console.log(`\n[${i + 1}] 相似度: ${(r.score * 100).toFixed(1)}%`)
        console.log(`    内容: ${r.content.substring(0, 100)}...`)
        if (r.parentContent) {
          console.log(`    父块: ${r.parentContent.substring(0, 80)}...`)
        }
      })
    } catch (error: any) {
      console.error(`❌ 请求失败:`, error.message)
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                      测试完成                                    ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
}

testSearch()

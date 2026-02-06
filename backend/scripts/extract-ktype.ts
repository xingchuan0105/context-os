/**
 * 提取并保存 K-Type 摘要到文件
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'
import { parsePDF } from '../lib/parsers/pdf.js'
import { processKTypeWorkflowWithFallback } from '../lib/processors/k-type.js'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

async function main() {
  console.log('📋 提取 K-Type 摘要')
  console.log('')

  try {
    // 读取 PDF
    const pdfPath = resolve(__dirname, '../test.pdf')
    const fileBuffer = readFileSync(pdfPath)
    const pdfData = new Uint8Array(fileBuffer)

    console.log('📄 解析 PDF...')
    const parseResult = await parsePDF(pdfData.buffer)
    console.log(`✅ 解析成功: ${parseResult.content.length} 字符`)

    console.log('')
    console.log('🔄 生成 K-Type 摘要...')

    // K-Type 分析
    const ktypeResult = await processKTypeWorkflowWithFallback(parseResult.content)

    console.log('✅ 分析完成')
    console.log('')

    // 保存到文件
    const fs = await import('fs')
    const outputPath = resolve(__dirname, 'KTYPE_SUMMARY.txt')

    const rawOutput = (ktypeResult as any).rawOutput
    const output = rawOutput ? JSON.stringify(rawOutput, null, 2) : JSON.stringify(ktypeResult, null, 2)

    fs.writeFileSync(outputPath, output, 'utf-8')
    console.log(`✅ 摘要已保存到: ${outputPath}`)
    console.log('')
  } catch (error: any) {
    console.error('❌ 错误:', error.message)
    process.exit(1)
  }
}

main()

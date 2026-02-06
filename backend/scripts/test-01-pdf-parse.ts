/**
 * 测试 PDF 解析功能
 * 独立测试，不涉及 API 调用
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseFile } from '../lib/parsers'

async function testPDFParsing() {
  console.log('='.repeat(70))
  console.log('📄 测试 PDF 解析功能')
  console.log('='.repeat(70))
  console.log()

  try {
    // 1. 读取 PDF 文件
    const pdfPath = resolve(process.cwd(), 'test.pdf')
    console.log(`📂 读取文件: ${pdfPath}`)

    const buffer = readFileSync(pdfPath)
    console.log(`  文件大小: ${(buffer.length / 1024).toFixed(2)} KB`)
    console.log()

    // 2. 解析 PDF
    console.log('🔍 开始解析 PDF...')
    const startTime = Date.now()

    const result = await parseFile(buffer, 'application/pdf', 'test.pdf')

    const duration = Date.now() - startTime
    console.log(`✅ 解析完成！耗时: ${duration}ms`)
    console.log()

    // 3. 显示结果
    console.log('📊 解析结果:')
    console.log(`  提取字符数: ${result.content.length}`)
    console.log(`  页数: ${result.metadata?.pages || '未知'}`)
    console.log()

    // 4. 显示内容预览
    console.log('📝 内容预览 (前500字符):')
    console.log('─'.repeat(70))
    console.log(result.content.substring(0, 500))
    console.log('─'.repeat(70))
    console.log()

    // 5. 统计信息
    const lines = result.content.split('\n')
    const words = result.content.split(/\s+/).filter(w => w.length > 0)

    console.log('📈 文本统计:')
    console.log(`  行数: ${lines.length}`)
    console.log(`  词数: ${words.length}`)
    console.log(`  平均行长: ${(result.content.length / lines.length).toFixed(1)} 字符`)
    console.log()

    console.log('✅ PDF 解析测试成功！')

  } catch (error: any) {
    console.error()
    console.error('❌ PDF 解析测试失败！')
    console.error(`  错误: ${error.message}`)
    if (error.stack) {
      console.error(`  堆栈: ${error.stack}`)
    }
    process.exit(1)
  }
}

testPDFParsing()

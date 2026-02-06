/**
 * 查看 K-Type 摘要
 *
 * 用途: 从 Qdrant 中提取文档层的 K-Type 摘要
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import {
  ensureUserCollection,
  getDocumentLayers,
  search,
} from '../lib/qdrant.js'

// 加载环境变量
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

/**
 * 主函数
 */
async function main() {
  console.log('📋 K-Type 摘要查看工具')
  console.log('')

  // 获取参数
  const args = process.argv.slice(2)
  const userId = args[0] || 'test-e2e-user'
  const docId = args[1] || 'test-e2e-pdf-doc'

  console.log(`👤 用户 ID: ${userId}`)
  console.log(`📄 文档 ID: ${docId}`)
  console.log('')

  try {
    // 确保 collection 存在
    const collectionName = await ensureUserCollection(userId)
    console.log(`✅ Collection: ${collectionName}`)
    console.log('')

    // 获取文档所有层级
    console.log('📊 获取文档层级...')
    const layers = await getDocumentLayers(userId, docId)

    if (!layers.document) {
      console.log('❌ 未找到文档层向量点')
      process.exit(1)
    }

    const docPoint = layers.document

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📄 K-Type 摘要')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // 输出内容
    console.log(docPoint.payload.content)
    console.log('')

    // 输出元数据
    if (docPoint.payload.metadata?.ktype) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📊 K-Type 元数据')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
      console.log(JSON.stringify(docPoint.payload.metadata.ktype, null, 2))
    }

    // 输出文件信息
    if (docPoint.payload.metadata?.file_name) {
      console.log('')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📁 文件信息')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
      console.log(`文件名: ${docPoint.payload.metadata.file_name}`)
      console.log(`向量 ID: ${docPoint.id}`)
      console.log(`Score (自身): ${docPoint.score || 'N/A'}`)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(`📦 父块数量: ${layers.parents.length}`)
    console.log(`📄 子块数量: ${layers.children.length}`)
    console.log('')

    // 保存到文件
    const fs = await import('fs')
    const outputPath = resolve(__dirname, `ktype-summary-${docId}.txt`)
    fs.writeFileSync(outputPath, docPoint.payload.content, 'utf-8')
    console.log(`✅ 摘要已保存到: ${outputPath}`)

  } catch (error: any) {
    console.error('')
    console.error('❌ 错误!')
    console.error(error.message)
    process.exit(1)
  }
}

main()

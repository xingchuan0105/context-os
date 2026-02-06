// 查询所有文档
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('查询所有测试文档...\n')

  // 使用 service_role 绕过 RLS
  const { data: docs, error } = await supabase
    .from('documents')
    .select('*')
    .like('file_name', 'test-bge-m3%')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('查询失败:', error)
    return
  }

  console.log(`找到 ${docs?.length || 0} 个测试文档\n`)

  if (docs && docs.length > 0) {
    for (const doc of docs) {
      console.log(`文档 ID: ${doc.id}`)
      console.log(`文件名: ${doc.file_name}`)
      console.log(`状态: ${doc.status}`)
      console.log(`块数量: ${doc.chunks_count}`)
      console.log(`错误: ${doc.error_message || '无'}`)

      // 查询 chunks
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select('id, is_parent, embedding')
        .eq('doc_id', doc.id)

      const parents = chunks?.filter(c => c.is_parent) || []
      const children = chunks?.filter(c => !c.is_parent) || []

      console.log(`  父块: ${parents.length}, 子块: ${children.length}`)

      if (children.length > 0) {
        const emb = children[0].embedding as number[]
        console.log(`  向量维度: ${emb?.length} ${emb?.length === 1024 ? '✅' : '❌'}`)
      }
      console.log()
    }
  }

  // 检查最新的 completed 文档
  const { data: completed } = await supabase
    .from('documents')
    .select('id, file_name, status, chunks_count, deep_summary')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (completed && completed.length > 0) {
    const doc = completed[0]
    console.log('═══════════════════════════════════════════════════════════')
    console.log('最新完成的文档:')
    console.log(`  ID: ${doc.id}`)
    console.log(`  文件: ${doc.file_name}`)
    console.log(`  块数: ${doc.chunks_count}`)

    if (doc.deep_summary) {
      const summary = doc.deep_summary as any
      console.log(`  认知索引:`)
      if (summary.classification) {
        console.log(`    类型: ${summary.classification.dominantType?.join(', ')}`)
      }
    }

    // 查询 chunks
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('id, is_parent, embedding')
      .eq('doc_id', doc.id)

    const parents = chunks?.filter(c => c.is_parent) || []
    const children = chunks?.filter(c => !c.is_parent) || []
    console.log(`  父块: ${parents.length}, 子块: ${children.length}`)

    if (children.length > 0) {
      const emb = children[0].embedding as number[]
      console.log(`  向量维度: ${emb?.length} ${emb?.length === 1024 ? '✅' : '❌'}`)
      console.log(`  前5个值: [${emb?.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`)
    }
  }
}

main().catch(console.error)

// 详细查询 chunks
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// 使用全局查询绕过 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: { schema: 'public' },
    global: false,
  }
)

async function main() {
  console.log('查询所有 chunks (绕过 RLS)...\n')

  // 查询最近的 chunks
  const { data: chunks, error } = await supabase
    .from('document_chunks')
    .select('*')
    .order('id', { ascending: false })
    .limit(10)

  if (error) {
    console.error('查询失败:', error)
    return
  }

  console.log(`找到 ${chunks?.length || 0} 个 chunks\n`)

  if (chunks && chunks.length > 0) {
    console.log('最近的 chunks:')
    for (const chunk of chunks) {
      const emb = chunk.embedding as number[]
      console.log(`  ID: ${chunk.id}`)
      console.log(`  doc_id: ${chunk.doc_id}`)
      console.log(`  is_parent: ${chunk.is_parent}`)
      console.log(`  embedding 维度: ${emb?.length}`)
      console.log(`  content 前50字符: ${(chunk.content || '').slice(0, 50)}`)
      console.log()
    }
  }

  // 检查特定文档
  const docId = 'f93b9a56-6a64-4ede-9d5a-ff5e764037bf'
  console.log(`\n检查文档 ${docId} 的 chunks:`)
  const { data: docChunks } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('doc_id', docId)

  console.log(`  找到 ${docChunks?.length || 0} 个 chunks`)
}

main().catch(console.error)

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
config({ path: envPath })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function setupKB() {
  // 检查是否有知识库
  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('id')
    .limit(1)

  let kbId: string

  if (!kbs || kbs.length === 0) {
    // 创建新的知识库
    const { data: newKb } = await supabase
      .from('knowledge_bases')
      .insert({
        name: 'Test Knowledge Base',
        user_id: '00000000-0000-0000-0000-000000000001',
      })
      .select('id')
      .single()

    kbId = newKb?.id || ''
    console.log('✅ 创建知识库:', kbId)
  } else {
    kbId = kbs[0]?.id || ''
    console.log('✅ 使用现有知识库:', kbId)
  }

  return kbId
}

setupKB().catch(console.error)

#!/usr/bin/env tsx
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

async function main() {
  // Use the first user ID from profiles
  const userId = 'eac2b544-7f81-4620-a30e-c1e3b70e53e6'

  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('id, title, user_id')
    .eq('user_id', userId)

  console.log(`Knowledge bases for user ${userId}:`)
  console.table(kbs)

  if (!kbs || kbs.length === 0) {
    // Create a new knowledge base for this user
    const { data: newKb } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        title: 'Test Knowledge Base',
      })
      .select('id')
      .single()

    console.log(`\nCreated new KB: ${newKb?.id}`)
  }
}

main()

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
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email')
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Users in database:')
  console.table(users)
}

main()

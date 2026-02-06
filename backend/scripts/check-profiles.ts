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
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email')
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Profiles in database:')
  console.table(profiles)

  // Also check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('Auth Error:', authError)
    return
  }

  console.log('\nAuth users:')
  authUsers.users.forEach((u: any) => console.log(`  - ${u.id}: ${u.email}`))
}

main()

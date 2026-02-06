import 'dotenv/config'

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseFile } from '../lib/parsers'
import { validateEnv } from '../lib/config/env'

async function main() {
  // Do not fail CI if env vars are missing unless explicitly strict.
  validateEnv()

  const samplePath = resolve(process.cwd(), 'test-document.txt')
  const buffer = readFileSync(samplePath)

  const result = await parseFile(buffer, 'text/plain', 'test-document.txt')
  if (!result.content || result.content.length === 0) {
    throw new Error('parseFile returned empty content')
  }

  console.log('[ci-smoke] ok')
}

main().catch((err) => {
  console.error('[ci-smoke] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

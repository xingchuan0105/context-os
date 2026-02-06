import { spawnSync } from 'child_process'

const strict = process.env.TYPECHECK_STRICT === '1'

if (!strict) {
  console.log('[typecheck] skipped (set TYPECHECK_STRICT=1 to enforce)')
  process.exit(0)
}

const isWin = process.platform === 'win32'
const command = isWin ? 'npx.cmd' : 'npx'
const args = ['tsc', '--noEmit']

const result = spawnSync(command, args, { stdio: 'inherit' })
process.exit(result.status ?? 1)

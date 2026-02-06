import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const candidates = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../.env.production'),
]

let loaded = false
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    config({ path: candidate })
    loaded = true
    break
  }
}

if (!loaded) {
  console.warn('Warning: no .env file found, using system environment variables')
}

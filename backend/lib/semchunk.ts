import { spawn } from 'child_process'

const SEMCHUNK_TIMEOUT_MS = parseInt(process.env.SEMCHUNK_TIMEOUT_MS || '300000', 10)

const SEMCHUNK_SCRIPT = `
import json
import re
import sys
import semchunk

def count_tokens(text):
    cjk = len(re.findall(r'[\\u4e00-\\u9fff]', text))
    words = len(re.findall(r'[A-Za-z0-9]+', text))
    other = len(re.findall(r'[^\\s]', text)) - cjk - words
    if other < 0:
        other = 0
    return cjk + words + other

payload = json.load(sys.stdin)
chunk_size = int(payload.get('chunk_size') or 0)
overlap = payload.get('overlap')
if overlap is not None:
    overlap = float(overlap)

chunker = semchunk.chunkerify(count_tokens, chunk_size)

texts = payload.get('texts')
if texts is not None:
    if overlap is None or overlap == 0:
        chunks = chunker(texts)
    else:
        chunks = chunker(texts, overlap=overlap)
    json.dump({'chunks': chunks}, sys.stdout, ensure_ascii=False)
else:
    text = payload.get('text', '')
    if overlap is None or overlap == 0:
        chunks = chunker(text)
    else:
        chunks = chunker(text, overlap=overlap)
    json.dump({'chunks': chunks}, sys.stdout, ensure_ascii=False)
`

export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  const other = (text.match(/[^\s]/g) || []).length - cjk - words
  return cjk + words + Math.max(0, other)
}

export async function runSemchunk(
  input: { text: string } | { texts: string[] },
  chunkSize: number,
  overlap?: number,
): Promise<string[] | string[][]> {
  const payload = JSON.stringify({
    ...input,
    chunk_size: chunkSize,
    overlap: overlap ?? null,
  })

  return new Promise((resolve, reject) => {
    const proc = spawn('python', ['-c', SEMCHUNK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`semchunk timeout after ${SEMCHUNK_TIMEOUT_MS}ms`))
    }, SEMCHUNK_TIMEOUT_MS)

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8')
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8')
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr || `semchunk failed with code ${code}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed.chunks || [])
      } catch (err) {
        reject(new Error(`semchunk parse error: ${err instanceof Error ? err.message : String(err)}`))
      }
    })

    proc.stdin.write(payload)
    proc.stdin.end()
  })
}

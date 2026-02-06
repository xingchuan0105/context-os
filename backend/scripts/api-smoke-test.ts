import 'dotenv/config'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { setTimeout as delay } from 'timers/promises'

const API_BASE = process.env.API_BASE || 'http://localhost:3000'
const EMAIL = process.env.SMOKE_EMAIL || `smoke-${Date.now()}@example.com`
const PASSWORD = process.env.SMOKE_PASSWORD || 'smoke-123456'
const FULL_NAME = 'API Smoke User'
const KB_TITLE = `API Smoke KB ${Date.now()}`
const FILE_PATH = process.env.SMOKE_FILE || 'test.pdf'
const QUERY = process.env.SMOKE_QUERY || '什么是封装？'

type ApiSuccess<T> = { success: true; data: T }

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie')
  if (!raw) return ''
  return raw.split(';')[0]
}

async function jsonOrText(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function registerOrLogin(): Promise<string> {
  const registerBody = JSON.stringify({ email: EMAIL, password: PASSWORD, full_name: FULL_NAME })
  const registerRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerBody).toString(),
    },
    body: registerBody,
  })

  if (registerRes.status === 409) {
    const loginBody = JSON.stringify({ email: EMAIL, password: PASSWORD })
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginBody).toString(),
      },
      body: loginBody,
    })
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await jsonOrText(loginRes)}`)
    }
    return extractCookie(loginRes)
  }

  if (!registerRes.ok) {
    throw new Error(`Register failed: ${await jsonOrText(registerRes)}`)
  }

  return extractCookie(registerRes)
}

async function createKnowledgeBase(cookie: string): Promise<string> {
  const body = JSON.stringify({ title: KB_TITLE })
  const res = await fetch(`${API_BASE}/api/knowledge-bases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body).toString(),
      Cookie: cookie,
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Create KB failed: ${await jsonOrText(res)}`)
  }
  const data = (await res.json()) as ApiSuccess<{ id: string }>
  return data.data.id
}

async function uploadDocument(cookie: string, kbId: string): Promise<string[]> {
  const abs = resolve(process.cwd(), FILE_PATH)
  const buffer = readFileSync(abs)
  const form = new FormData()
  form.append('kb_id', kbId)
  form.append('autoProcess', 'true')
  form.append('file', new Blob([buffer]), FILE_PATH)

  const res = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${await jsonOrText(res)}`)
  }
  const payload = (await res.json()) as ApiSuccess<any>
  const docs = payload.data.documents || (payload.data.document ? [payload.data.document] : [])
  return docs.map((d: any) => d.id).filter(Boolean)
}

async function waitForDocuments(cookie: string, kbId: string, docIds: string[]) {
  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/api/documents?kb_id=${kbId}`, {
      headers: { Cookie: cookie },
    })
    if (!res.ok) {
      throw new Error(`Fetch documents failed: ${await jsonOrText(res)}`)
    }
    const payload = (await res.json()) as ApiSuccess<any[]>
    const docs = payload.data.filter((d) => docIds.includes(d.id))
    const pending = docs.filter((d) => d.status !== 'completed' && d.status !== 'failed')
    if (pending.length === 0) {
      return docs
    }
    console.log(`[poll] waiting... completed=${docs.length - pending.length}/${docs.length}`)
    await delay(5000)
  }
  throw new Error('Timeout waiting for document processing')
}

async function createChatSession(cookie: string, kbId: string): Promise<string> {
  const body = JSON.stringify({ kbId, title: 'API Smoke Session' })
  const res = await fetch(`${API_BASE}/api/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body).toString(),
      Cookie: cookie,
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Create session failed: ${await jsonOrText(res)}`)
  }
  const payload = (await res.json()) as ApiSuccess<{ session: { id: string } }>
  return payload.data.session.id
}

async function sendMessage(cookie: string, sessionId: string, docIds: string[]) {
  const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ message: QUERY, selectedSourceIds: docIds }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`Send message failed: ${await jsonOrText(res)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let answer = ''
  let errorMessage = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const jsonText = line.replace(/^data:\s*/, '')
      try {
        const event = JSON.parse(jsonText)
        if (event.type === 'token' && event.data?.content) {
          answer += event.data.content
        }
        if (event.type === 'error') {
          const msg = event.data?.message || event.data
          errorMessage = typeof msg === 'string' ? msg : JSON.stringify(msg)
        }
        if (event.type === 'done') {
          if (!answer.trim() && event.data?.content) {
            answer = event.data.content
          }
          return answer.trim() || errorMessage
        }
      } catch {
        continue
      }
    }
  }

  return answer.trim() || errorMessage
}

async function main() {
  console.log('[smoke] api base:', API_BASE)
  console.log('[smoke] file:', FILE_PATH)
  const cookie = await registerOrLogin()
  if (!cookie) {
    throw new Error('Missing auth cookie')
  }
  console.log('[smoke] auth ok')

  const kbId = await createKnowledgeBase(cookie)
  console.log('[smoke] kb:', kbId)

  const docIds = await uploadDocument(cookie, kbId)
  console.log('[smoke] uploaded docIds:', docIds.join(', '))

  const docs = await waitForDocuments(cookie, kbId, docIds)
  for (const doc of docs) {
    console.log(
      `[smoke] doc ${doc.id} status=${doc.status} ktype=${doc.ktype_summary?.length || 0} deep=${doc.deep_summary?.length || 0}`
    )
  }

  const sessionId = await createChatSession(cookie, kbId)
  console.log('[smoke] session:', sessionId)

  const answer = await sendMessage(cookie, sessionId, docIds)
  console.log('\n[smoke] answer:\n' + answer)
}

main().catch((err) => {
  console.error('[smoke] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

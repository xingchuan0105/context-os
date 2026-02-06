import { readFileSync } from 'fs'
import { join } from 'path'
import { signToken } from '../lib/auth/jwt'
import { db } from '../lib/db/schema'

const API_BASE = process.env.API_BASE || 'http://localhost:3003'

async function debugUpload() {
  // 获取测试用户
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get('test@context-os.local') as { id: string; email: string } | undefined

  if (!user) {
    console.log('User not found')
    return
  }

  // 获取测试知识库
  const kb = db
    .prepare('SELECT * FROM knowledge_bases WHERE user_id = ? AND title = ?')
    .get(user.id, 'RAG 测试知识库') as { id: string; title: string } | undefined

  if (!kb) {
    console.log('KB not found')
    return
  }

  console.log('User:', user.id)
  console.log('KB:', kb.id)

  // 生成 token
  const token = await signToken({ userId: user.id, email: user.email })
  console.log('Token:', token.substring(0, 50) + '...')

  // 读取 PDF
  const pdfPath = join(process.cwd(), 'test.pdf')
  const pdfBuffer = readFileSync(pdfPath)
  console.log('PDF size:', pdfBuffer.length)

  // 创建 FormData
  const formData = new FormData()
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
  const file = new File([blob], 'test.pdf', { type: 'application/pdf' })
  formData.append('file', file)
  formData.append('kb_id', kb.id)
  formData.append('autoProcess', 'true')

  // 上传
  const url = `${API_BASE}/api/documents`
  console.log('Uploading to:', url)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Cookie': `auth_token=${token}`,
    },
    body: formData,
  })

  console.log('Response status:', response.status)
  console.log('Response ok:', response.ok)

  const text = await response.text()
  console.log('Response body:', text)
}

debugUpload().catch(console.error)

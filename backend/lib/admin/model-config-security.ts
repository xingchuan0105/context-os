import crypto from 'crypto'

function getSecret(): string {
  const value =
    process.env.CONFIG_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'context-os-dev-config-secret')

  if (!value) {
    throw new Error('Missing CONFIG_ENCRYPTION_KEY (or JWT_SECRET) for model config encryption')
  }

  return value
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

export function maskApiKey(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`
}

export function encryptSecret(plain: string): string {
  const secret = getSecret()
  const key = deriveKey(secret)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptSecret(payload?: string | null): string | null {
  if (!payload) return null

  const [ivB64, tagB64, contentB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !contentB64) return null

  const secret = getSecret()
  const key = deriveKey(secret)
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const content = Buffer.from(contentB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()])
  return decrypted.toString('utf8')
}

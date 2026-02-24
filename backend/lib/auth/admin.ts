import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { ForbiddenError, UnauthorizedError } from '@/lib/api/errors'
import { db } from '@/lib/db/schema'
import { hashPassword, verifyPassword } from './password'
import { signToken, verifyToken } from './jwt'

export type AdminRole = 'super_admin' | 'report_viewer'

export interface AdminUser {
  id: string
  email: string
  role: AdminRole
  isActive: boolean
  lastLoginAt: string | null
}

type AdminAccountRow = {
  id: string
  email: string
  role: string
  password_hash: string
  is_active: number
  last_login_at: string | null
}

const ADMIN_COOKIE_NAME = 'admin_token'
const DEFAULT_SUPER_ADMIN_EMAIL = 'xingchuan0105@163.com'
const DEFAULT_SUPER_ADMIN_PASSWORD = 'Xc880105'

let bootstrapPromise: Promise<void> | null = null

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getSecureCookieFlag(): boolean {
  return process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE !== 'false'
    : process.env.NODE_ENV === 'production'
}

function toAdminRole(role: string): AdminRole {
  return role === 'super_admin' ? 'super_admin' : 'report_viewer'
}

function toAdminUser(row: AdminAccountRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    role: toAdminRole(row.role),
    isActive: row.is_active === 1,
    lastLoginAt: row.last_login_at,
  }
}

async function ensureAdminAccount(params: {
  email: string
  password: string
  role: AdminRole
  syncPassword?: boolean
}): Promise<void> {
  const email = normalizeEmail(params.email)
  const existing = db
    .prepare('SELECT id, role, is_active FROM admin_accounts WHERE email = ?')
    .get(email) as { id: string; role: string; is_active: number } | undefined

  if (!existing) {
    const passwordHash = await hashPassword(params.password)
    db.prepare(
      `INSERT INTO admin_accounts (id, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
    ).run(randomUUID(), email, passwordHash, params.role)
    return
  }

  const needsRoleSync = existing.role !== params.role || existing.is_active !== 1

  if (params.syncPassword) {
    const passwordHash = await hashPassword(params.password)
    db.prepare(
      `UPDATE admin_accounts
       SET password_hash = ?, role = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(passwordHash, params.role, existing.id)
    return
  }

  if (needsRoleSync) {
    db.prepare(
      `UPDATE admin_accounts
       SET role = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(params.role, existing.id)
  }
}

async function ensureBootstrapAdmins(): Promise<void> {
  const superAdminEmail = normalizeEmail(
    process.env.ADMIN_SUPER_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL,
  )
  const superAdminPassword = process.env.ADMIN_SUPER_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error('Missing admin bootstrap configuration')
  }

  await ensureAdminAccount({
    email: superAdminEmail,
    password: superAdminPassword,
    role: 'super_admin',
    syncPassword: true,
  })

  const reportAdminEmail = normalizeEmail(process.env.ADMIN_REPORT_EMAIL || '')
  const reportAdminPassword = process.env.ADMIN_REPORT_PASSWORD || ''

  if (reportAdminEmail && reportAdminPassword) {
    await ensureAdminAccount({
      email: reportAdminEmail,
      password: reportAdminPassword,
      role: 'report_viewer',
      syncPassword: true,
    })
  }
}

async function ensureBootstrapAdminsOnce(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureBootstrapAdmins().catch((error) => {
      bootstrapPromise = null
      throw error
    })
  }

  await bootstrapPromise
}

async function getAdminById(id: string): Promise<AdminUser | null> {
  const row = db
    .prepare(
      `SELECT id, email, role, password_hash, is_active, last_login_at
       FROM admin_accounts
       WHERE id = ? AND is_active = 1`,
    )
    .get(id) as AdminAccountRow | undefined

  return row ? toAdminUser(row) : null
}

export async function authenticateAdmin(email: string, password: string): Promise<AdminUser | null> {
  await ensureBootstrapAdminsOnce()

  const normalizedEmail = normalizeEmail(email)
  const row = db
    .prepare(
      `SELECT id, email, role, password_hash, is_active, last_login_at
       FROM admin_accounts
       WHERE email = ? AND is_active = 1`,
    )
    .get(normalizedEmail) as AdminAccountRow | undefined

  if (!row) {
    return null
  }

  const isValid = await verifyPassword(password, row.password_hash)
  if (!isValid) {
    return null
  }

  db.prepare(
    `UPDATE admin_accounts
     SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(row.id)

  const updated = await getAdminById(row.id)
  return updated
}

export async function createAdminSession(admin: AdminUser): Promise<void> {
  const token = await signToken({
    userId: admin.id,
    email: admin.email,
  })

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: getSecureCookieFlag(),
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE_NAME)
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  await ensureBootstrapAdminsOnce()

  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload?.userId) {
    return null
  }

  return getAdminById(payload.userId)
}

export async function requireAdminUser(): Promise<AdminUser> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    throw new UnauthorizedError('Admin login required')
  }
  return admin
}

export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdminUser()
  if (admin.role !== 'super_admin') {
    throw new ForbiddenError('Super admin permission required')
  }
  return admin
}

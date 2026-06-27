import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { query, queryOne, execute, dbUserToUser, type DbUser } from './db'
import type { User } from './types'
import type { PermissionKey } from './permissions'
import { hasPermission } from './permissions'

const SESSION_DAYS = 7

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS)

  await execute('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [
    token,
    userId,
    expiresAt.toISOString(),
  ])

  return token
}

export async function deleteSession(token: string): Promise<void> {
  await execute('DELETE FROM sessions WHERE token = ?', [token])
}

export async function getUserBySession(token: string | null): Promise<User | null> {
  if (!token) return null

  const session = await queryOne<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?',
    [token]
  )

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) {
    await execute('DELETE FROM sessions WHERE token = ?', [token])
    return null
  }

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE id = ?', [session.user_id])
  if (!user) return null
  if (user.access_locked) {
    await execute('DELETE FROM sessions WHERE token = ?', [token])
    return null
  }
  return dbUserToUser(user)
}

export async function getUserByLogin(login: string): Promise<DbUser | null> {
  const user = await queryOne<DbUser>(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [login, login]
  )
  return user ?? null
}

export function requireRole(user: User | null, roles: User['role'][]): User {
  if (!user || !roles.includes(user.role)) {
    throw new Error('Unauthorized')
  }
  return user
}

export function requireStaffAccess(user: User | null): User {
  return requireRole(user, ['admin', 'staff'])
}

export function requirePermission(user: User | null, permission: PermissionKey): User {
  const u = requireStaffAccess(user)
  if (!hasPermission(u, permission)) {
    throw new Error('Unauthorized')
  }
  return u
}

export function getTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return request.headers.get('x-session-token')
}

import bcrypt from 'bcryptjs'
import { queryOne, dbUserToUser, type DbUser } from './db'
import type { User } from './types'
import type { PermissionKey } from './permissions'
import { hasPermission } from './permissions'
import { signAccessToken, verifyAccessToken } from './jwt'

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function createAccessToken(user: {
  id: string
  role: string
  username: string
}): string {
  return signAccessToken({
    sub: user.id,
    role: user.role,
    username: user.username,
  })
}

/** @deprecated Use createAccessToken — kept for any legacy imports */
export function createSession(user: DbUser | { id: string; role: string; username: string }): string {
  return createAccessToken({
    id: user.id,
    role: user.role,
    username: user.username,
  })
}

export async function deleteSession(_token: string): Promise<void> {
  // JWT is stateless; client clears the token on logout.
}

export async function getUserBySession(token: string | null): Promise<User | null> {
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE id = ?', [payload.sub])
  if (!user) return null
  if (user.access_locked) return null

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

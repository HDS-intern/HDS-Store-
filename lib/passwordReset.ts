import { randomBytes } from 'crypto'
import { queryOne, execute } from './db'
import { getUserByLogin, hashPassword } from './auth'

const RESET_HOURS = 1

export async function createPasswordResetToken(
  login: string
): Promise<{ token: string; role: string } | null> {
  const user = await getUserByLogin(login.trim())
  if (!user) return null

  await execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])

  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESET_HOURS * 60 * 60 * 1000)

  await execute(
    `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [token, user.id, expiresAt.toISOString(), now.toISOString()]
  )

  return { token, role: user.role }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: true; role: string }> {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters')
  }

  const row = await queryOne<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?',
    [token]
  )

  if (!row) {
    throw new Error('Invalid or expired reset link')
  }

  if (new Date(row.expires_at) < new Date()) {
    await execute('DELETE FROM password_reset_tokens WHERE token = ?', [token])
    throw new Error('Reset link has expired. Please request a new one.')
  }

  const user = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = ?', [
    row.user_id,
  ])
  if (!user) {
    throw new Error('Account not found')
  }

  const hash = hashPassword(newPassword)

  if (user.role === 'admin' || user.role === 'staff') {
    await execute('UPDATE users SET password_hash = ?, password_plain = ? WHERE id = ?', [
      hash,
      newPassword,
      row.user_id,
    ])
  } else {
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id])
  }

  await execute('DELETE FROM password_reset_tokens WHERE token = ?', [token])

  return { success: true, role: user.role }
}

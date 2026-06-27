import { randomUUID } from 'crypto'
import { queryOne, execute } from './db'

export function normalizeGuestChatId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('guest-') || trimmed.length < 12) return null
  return trimmed
}

export async function ensureGuestChatUser(guestId: string): Promise<string> {
  const userId = normalizeGuestChatId(guestId)
  if (!userId) throw new Error('Invalid guest session')

  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId])
  if (existing) return userId

  const suffix = userId.slice(6, 14)
  const username = `guest_${suffix}`
  const email = `${username}@guest.hds.local`

  await execute(
    `INSERT INTO users (id, username, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'customer', ?)`,
    [userId, username, email, 'guest-no-login', 'Guest Visitor', new Date().toISOString()]
  )

  return userId
}

export function createGuestChatId(): string {
  return `guest-${randomUUID()}`
}

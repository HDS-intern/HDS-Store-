import { randomBytes } from 'crypto'
import { query, queryOne, execute } from './db'

export type ContactMessage = {
  id: string
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  createdAt: string
  read: boolean
}

type ContactMessageRow = {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string
  message: string
  created_at: string
  read_at: string | null
}

function rowToMessage(row: ContactMessageRow): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at,
    read: Boolean(row.read_at),
  }
}

export async function createContactMessage(input: {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}): Promise<ContactMessage> {
  const id = `MSG-${Date.now()}${randomBytes(3).toString('hex')}`
  const createdAt = new Date().toISOString()

  await execute(
    `INSERT INTO contact_messages (id, name, email, phone, subject, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.email.trim(),
      input.phone?.trim() || null,
      input.subject.trim(),
      input.message.trim(),
      createdAt,
    ]
  )

  return {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    subject: input.subject.trim(),
    message: input.message.trim(),
    createdAt,
    read: false,
  }
}

export async function countUnreadContactMessages(): Promise<number> {
  const row = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM contact_messages WHERE read_at IS NULL'
  )
  return row?.count ?? 0
}

export async function markAllContactMessagesRead(): Promise<number> {
  const now = new Date().toISOString()
  const rows = await query<{ id: string }>(
    'UPDATE contact_messages SET read_at = ? WHERE read_at IS NULL RETURNING id',
    [now]
  )
  return rows.length
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const rows = await query<ContactMessageRow>(
    'SELECT * FROM contact_messages ORDER BY created_at DESC'
  )
  return rows.map(rowToMessage)
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'DELETE FROM contact_messages WHERE id = ? RETURNING id',
    [id]
  )
  return rows.length > 0
}

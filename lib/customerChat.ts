import { randomUUID } from 'crypto'
import { query, queryOne, execute } from './db'
import type { ChatChannel, ChatMessage, ChatSender, ChatThreadSummary } from './chatTypes'

type ChatRow = {
  id: string
  user_id: string
  channel: string
  sender: string
  body: string
  created_at: string
  read_at: string | null
}

function rowToMessage(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel as ChatChannel,
    sender: row.sender as ChatSender,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
  }
}

export async function listChatMessages(
  userId: string,
  channel: ChatChannel
): Promise<ChatMessage[]> {
  const rows = await query<ChatRow>(
    `SELECT id, user_id, channel, sender, body, created_at, read_at
     FROM chat_messages
     WHERE user_id = ? AND channel = ?
     ORDER BY created_at ASC`,
    [userId, channel]
  )
  return rows.map(rowToMessage)
}

export async function insertChatMessage(input: {
  userId: string
  channel: ChatChannel
  sender: ChatSender
  body: string
}): Promise<ChatMessage> {
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  await execute(
    `INSERT INTO chat_messages (id, user_id, channel, sender, body, created_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [id, input.userId, input.channel, input.sender, input.body.trim(), createdAt]
  )

  return {
    id,
    userId: input.userId,
    channel: input.channel,
    sender: input.sender,
    body: input.body.trim(),
    createdAt,
  }
}

export async function markSupportMessagesRead(
  userId: string,
  forSender: 'customer' | 'staff'
): Promise<void> {
  const targetSender = forSender === 'customer' ? 'staff' : 'customer'
  await execute(
    `UPDATE chat_messages
     SET read_at = ?
     WHERE user_id = ? AND channel = 'support' AND sender = ? AND read_at IS NULL`,
    [new Date().toISOString(), userId, targetSender]
  )
}

export async function countUnreadSupportForCustomer(userId: string): Promise<number> {
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM chat_messages
     WHERE user_id = ? AND channel = 'support' AND sender = 'staff' AND read_at IS NULL`,
    [userId]
  )
  return row?.c ?? 0
}

export async function listSupportThreads(): Promise<ChatThreadSummary[]> {
  const rows = await query<{
    user_id: string
    customer_name: string
    customer_email: string
    last_message: string
    last_message_at: string
    unread_count: number
  }>(
    `SELECT m.user_id, u.name AS customer_name, u.email AS customer_email,
            m.body AS last_message, m.created_at AS last_message_at,
            (
              SELECT COUNT(*)::int FROM chat_messages um
              WHERE um.user_id = m.user_id AND um.channel = 'support'
                AND um.sender = 'customer' AND um.read_at IS NULL
            ) AS unread_count
     FROM chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.channel = 'support'
       AND m.created_at = (
         SELECT MAX(created_at) FROM chat_messages
         WHERE user_id = m.user_id AND channel = 'support'
       )
     ORDER BY m.created_at DESC`
  )

  return rows.map((row) => ({
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
  }))
}

export async function countUnreadSupportThreads(): Promise<number> {
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(DISTINCT user_id)::int AS c FROM chat_messages
     WHERE channel = 'support' AND sender = 'customer' AND read_at IS NULL`
  )
  return row?.c ?? 0
}

export async function countUnreadCustomerChatMessages(): Promise<number> {
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM chat_messages
     WHERE channel = 'support' AND sender = 'customer' AND read_at IS NULL`
  )
  return row?.c ?? 0
}

export async function deleteSupportChatMessage(messageId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM chat_messages WHERE id = ? AND channel = 'support' RETURNING id`,
    [messageId]
  )
  return rows.length > 0
}

export async function deleteSupportThread(userId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM chat_messages WHERE user_id = ? AND channel = 'support' RETURNING id`,
    [userId]
  )
  return rows.length
}

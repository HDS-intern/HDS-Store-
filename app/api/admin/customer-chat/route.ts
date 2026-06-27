import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import {
  countUnreadCustomerChatMessages,
  deleteSupportChatMessage,
  deleteSupportThread,
  insertChatMessage,
  listChatMessages,
  listSupportThreads,
  markSupportMessagesRead,
} from '@/lib/customerChat'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (userId) {
      await markSupportMessagesRead(userId, 'staff')
      const messages = await listChatMessages(userId, 'support')
      return NextResponse.json({ messages, userId })
    }

    const threads = await listSupportThreads()
    const unreadCount = await countUnreadCustomerChatMessages()
    return NextResponse.json({ threads, unreadCount })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const staff = requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const { userId, message } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const body = typeof message === 'string' ? message.trim() : ''
    if (!body) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const reply = await insertChatMessage({
      userId,
      channel: 'support',
      sender: 'staff',
      body,
    })

    return NextResponse.json({ message: reply, staffName: staff.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const body = await request.json()
    const messageId = typeof body.messageId === 'string' ? body.messageId : ''
    const userId = typeof body.userId === 'string' ? body.userId : ''

    if (userId) {
      const deletedCount = await deleteSupportThread(userId)
      if (deletedCount === 0) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      const unreadCount = await countUnreadCustomerChatMessages()
      return NextResponse.json({ success: true, deletedCount, unreadCount })
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID or user ID required' }, { status: 400 })
    }

    const deleted = await deleteSupportChatMessage(messageId)
    if (!deleted) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const unreadCount = await countUnreadCustomerChatMessages()
    return NextResponse.json({ success: true, unreadCount })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

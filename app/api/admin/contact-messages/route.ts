import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import {
  countUnreadContactMessages,
  deleteContactMessage,
  listContactMessages,
  markAllContactMessagesRead,
} from '@/lib/contactMessages'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const messages = await listContactMessages()
    const unreadCount = await countUnreadContactMessages()
    return NextResponse.json(
      { messages, unreadCount },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const body = await request.json().catch(() => ({}))
    if (body.action !== 'mark_read') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }
    const marked = await markAllContactMessagesRead()
    return NextResponse.json({
      success: true,
      marked,
      unreadCount: await countUnreadContactMessages(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    const deleted = await deleteContactMessage(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      unreadCount: await countUnreadContactMessages(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

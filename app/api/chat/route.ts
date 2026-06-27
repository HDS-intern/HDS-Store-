import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest } from '@/lib/auth'
import {
  countUnreadSupportForCustomer,
  insertChatMessage,
  listChatMessages,
  markSupportMessagesRead,
} from '@/lib/customerChat'
import { ensureGuestChatUser, normalizeGuestChatId } from '@/lib/guestChat'
import { getBotGreeting, getBotReply } from '@/lib/chatbot'
import type { ChatChannel } from '@/lib/chatTypes'

export const runtime = 'nodejs'

async function resolveChatUserId(request: Request): Promise<string> {
  const sessionUser = await getUserBySession(getTokenFromRequest(request))
  if (sessionUser?.role === 'customer') {
    return sessionUser.id
  }

  const guestId = normalizeGuestChatId(request.headers.get('x-guest-chat-id') ?? '')
  if (guestId) {
    return ensureGuestChatUser(guestId)
  }

  throw new Error('Unauthorized')
}

export async function GET(request: Request) {
  try {
    const userId = await resolveChatUserId(request)
    const { searchParams } = new URL(request.url)
    const channel = (searchParams.get('channel') || 'bot') as ChatChannel

    if (channel !== 'bot' && channel !== 'support') {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    if (searchParams.get('countOnly') === '1' && channel === 'support') {
      return NextResponse.json({ unreadSupport: await countUnreadSupportForCustomer(userId) })
    }

    let messages = await listChatMessages(userId, channel)

    if (channel === 'bot' && messages.length === 0) {
      const greeting = await insertChatMessage({
        userId,
        channel: 'bot',
        sender: 'bot',
        body: getBotGreeting(),
      })
      messages = [greeting]
    }

    if (channel === 'support') {
      await markSupportMessagesRead(userId, 'customer')
    }

    const unreadSupport = await countUnreadSupportForCustomer(userId)

    return NextResponse.json({ messages, unreadSupport })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveChatUserId(request)
    const { channel, message } = await request.json()
    const chatChannel = channel as ChatChannel

    if (chatChannel !== 'bot' && chatChannel !== 'support') {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }

    const body = typeof message === 'string' ? message.trim() : ''
    if (!body) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const customerMessage = await insertChatMessage({
      userId,
      channel: chatChannel,
      sender: 'customer',
      body,
    })

    if (chatChannel === 'bot') {
      const reply = await insertChatMessage({
        userId,
        channel: 'bot',
        sender: 'bot',
        body: getBotReply(body),
      })
      return NextResponse.json({ messages: [customerMessage, reply] })
    }

    return NextResponse.json({
      messages: [customerMessage],
      notice: 'Your message was sent to our support team. We will reply here shortly.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

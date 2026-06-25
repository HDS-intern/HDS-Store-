import { NextResponse } from 'next/server'
import { createContactMessage } from '@/lib/contactMessages'
import { notifySyncedEmailOfTicket } from '@/lib/ticketEmailSync'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, subject, message } = body

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, subject, and message are required' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (String(message).trim().length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }

    const saved = createContactMessage({
      name: String(name),
      email: String(email),
      phone: phone ? String(phone) : undefined,
      subject: String(subject),
      message: String(message),
    })

    try {
      await notifySyncedEmailOfTicket(saved)
    } catch (mailError) {
      console.error('Ticket notification email failed:', mailError)
    }

    return NextResponse.json({ success: true, messageId: saved.id })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

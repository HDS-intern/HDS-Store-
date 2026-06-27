import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  getSyncedTicketEmail,
  sendTicketEmailOtp,
  verifyTicketEmailOtp,
  clearSyncedTicketEmail,
} from '@/lib/ticketEmailSync'
import { isMailConfigured } from '@/lib/mail'

export const runtime = 'nodejs'

async function requireAdmin(request: Request) {
  return requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    return NextResponse.json({
      syncedEmail: await getSyncedTicketEmail(),
      mailConfigured: isMailConfigured(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const action = body?.action

    if (action === 'send_otp') {
      const email = typeof body.email === 'string' ? body.email : ''
      if (!email.trim()) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }
      await sendTicketEmailOtp(email)
      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email.',
      })
    }

    if (action === 'verify_otp') {
      const email = typeof body.email === 'string' ? body.email : ''
      const otp = typeof body.otp === 'string' ? body.otp : String(body.otp ?? '')
      if (!email.trim()) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }
      await verifyTicketEmailOtp(email, otp)
      return NextResponse.json({
        success: true,
        syncedEmail: await getSyncedTicketEmail(),
        message: 'Email verified and synced for ticket notifications.',
      })
    }

    if (action === 'unsync') {
      await clearSyncedTicketEmail()
      return NextResponse.json({ success: true, syncedEmail: null })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

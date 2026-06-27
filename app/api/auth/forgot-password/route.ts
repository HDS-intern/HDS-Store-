import { NextResponse } from 'next/server'
import { createPasswordResetToken } from '@/lib/passwordReset'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { login } = await request.json()

    if (!login?.trim()) {
      return NextResponse.json({ error: 'Username or email is required' }, { status: 400 })
    }

    const result = await createPasswordResetToken(login)
    if (!result) {
      return NextResponse.json(
        { error: 'No account found with that username or email' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Password reset link created. Set your new password to continue.',
      token: result.token,
      role: result.role,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

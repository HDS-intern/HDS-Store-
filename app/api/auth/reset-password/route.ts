import { NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/passwordReset'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token?.trim() || !password) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    const result = await resetPasswordWithToken(token.trim(), password)
    return NextResponse.json({
      message: 'Password updated successfully. You can now log in.',
      role: result.role,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reset password'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

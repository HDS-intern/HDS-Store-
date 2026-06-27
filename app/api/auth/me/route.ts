import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = getTokenFromRequest(request)
  const user = await getUserBySession(token)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({ user })
}

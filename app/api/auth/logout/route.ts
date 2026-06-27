import { NextResponse } from 'next/server'
import { deleteSession, getTokenFromRequest, getUserBySession } from '@/lib/auth'
import { recordStaffLogout } from '@/lib/staffAttendance'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const token = getTokenFromRequest(request)
  if (token) {
    const user = await getUserBySession(token)
    if (user?.role === 'staff') {
      await recordStaffLogout(user.id)
    }
    await deleteSession(token)
  }
  return NextResponse.json({ success: true })
}

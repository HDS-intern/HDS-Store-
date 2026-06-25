import { NextResponse } from 'next/server'
import { getUserByLogin, verifyPassword, createSession } from '@/lib/auth'
import { dbUserToUser } from '@/lib/db'
import { recordStaffLogin } from '@/lib/staffAttendance'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { login, password } = body ?? {}

    if (!login?.trim() || !password) {
      return NextResponse.json({ error: 'Username/email and password are required' }, { status: 400 })
    }

    const user = getUserByLogin(login.trim())
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    if (user.access_locked) {
      return NextResponse.json(
        { error: 'Your account access has been locked by an administrator.' },
        { status: 403 }
      )
    }

    const token = createSession(user.id)

    if (user.role === 'staff') {
      recordStaffLogin(user.id)
    }

    return NextResponse.json({ token, user: dbUserToUser(user) })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}

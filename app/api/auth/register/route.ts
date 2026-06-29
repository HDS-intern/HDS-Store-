import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { queryOne, execute, dbUserToUser, type DbUser } from '@/lib/db'
import { hashPassword, createAccessToken } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { username, email, password, name, phone } = await request.json()

    if (!username?.trim() || !email?.trim() || !password || !name?.trim()) {
      return NextResponse.json(
        { error: 'Username, email, name, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters' },
        { status: 400 }
      )
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username.trim(), email.trim()]
    )

    if (existing) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }

    const id = randomUUID()
    const hash = hashPassword(password)
    const now = new Date().toISOString()

    await execute(
      `INSERT INTO users (id, username, email, password_hash, name, role, phone, created_at)
       VALUES (?, ?, ?, ?, ?, 'customer', ?, ?)`,
      [id, username.trim(), email.trim(), hash, name.trim(), phone?.trim() || null, now]
    )

    const user = await queryOne<DbUser>('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
    }

    const token = createAccessToken(user)

    return NextResponse.json({ token, user: dbUserToUser(user) })
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { query, queryOne, execute, dbUserToUser } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requirePermission, hashPassword } from '@/lib/auth'
import { parsePermissions, permissionsForRole, type UserPermissions } from '@/lib/permissions'
import type { User } from '@/lib/types'

export const runtime = 'nodejs'

function serializeUser(row: Record<string, unknown>, includePassword = false) {
  const user = dbUserToUser(row as Parameters<typeof dbUserToUser>[0])
  const base = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    permissions: user.permissions ?? null,
    access_locked: Boolean(row.access_locked),
    created_at: row.created_at,
  }
  if (includePassword) {
    return {
      ...base,
      password_plain: (row.password_plain as string | null) ?? null,
    }
  }
  return base
}

function resolvePermissions(role: string, permissions?: Partial<UserPermissions>): string | null {
  if (role === 'customer') return null
  if (role === 'admin') return JSON.stringify(permissionsForRole('admin'))
  const base = permissionsForRole('staff')
  if (permissions) {
    for (const key of Object.keys(base) as (keyof UserPermissions)[]) {
      if (typeof permissions[key] === 'boolean') base[key] = permissions[key]!
    }
  }
  return JSON.stringify(base)
}

export async function GET(request: Request) {
  try {
    const requester = requirePermission(
      await getUserBySession(getTokenFromRequest(request)),
      'users_manage'
    )
    const includePassword = requester.role === 'admin'
    const rows = await query<Record<string, unknown>>(
      `SELECT id, username, email, name, role, phone, permissions, access_locked, created_at${
        includePassword ? ', password_plain' : ''
      }
       FROM users
       WHERE role IN ('staff', 'admin')
       ORDER BY created_at DESC`
    )
    return NextResponse.json({ users: rows.map((row) => serializeUser(row, includePassword)) })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'users_manage')
    const { username, email, password, name, role, phone, permissions, staffRecordId } =
      await request.json()

    if (!staffRecordId?.trim()) {
      return NextResponse.json({ error: 'Staff member selection is required' }, { status: 400 })
    }

    if (!username?.trim() || !email?.trim() || !password || !name?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!['staff', 'customer', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username.trim(), email.trim()]
    )

    if (existing) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }

    const staffRow = await queryOne<{
      id: string
      user_id: string | null
      employee_name: string
    }>('SELECT id, user_id, employee_name FROM staff_records WHERE id = ?', [staffRecordId.trim()])

    if (!staffRow) {
      return NextResponse.json({ error: 'Staff record not found' }, { status: 404 })
    }

    if (staffRow.user_id) {
      return NextResponse.json(
        { error: 'This staff member already has a login account' },
        { status: 409 }
      )
    }

    const id = randomUUID()
    const hash = hashPassword(password)
    const now = new Date().toISOString()
    const permsJson = resolvePermissions(role, permissions)

    await execute(
      `INSERT INTO users (id, username, email, password_hash, password_plain, name, role, phone, permissions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        username.trim(),
        email.trim(),
        hash,
        password,
        name.trim(),
        role,
        phone?.trim() || null,
        permsJson,
        now,
      ]
    )

    await execute('UPDATE staff_records SET user_id = ?, updated_at = ? WHERE id = ?', [
      id,
      now,
      staffRow.id,
    ])

    const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
    return NextResponse.json({ user: serializeUser(user!) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const requester = requirePermission(
      await getUserBySession(getTokenFromRequest(request)),
      'users_manage'
    )
    const { id, permissions, role, accessLocked } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const existing = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [
      id,
    ])
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingRole = existing.role as User['role']

    if (accessLocked !== undefined) {
      if (requester.role !== 'admin') {
        return NextResponse.json({ error: 'Only administrators can change account access' }, { status: 403 })
      }
      if (existingRole !== 'staff') {
        return NextResponse.json({ error: 'Access lock applies to staff accounts only' }, { status: 400 })
      }
      if (id === requester.id) {
        return NextResponse.json({ error: 'You cannot lock your own account' }, { status: 400 })
      }

      const locked = Boolean(accessLocked)
      await execute('UPDATE users SET access_locked = ? WHERE id = ?', [locked ? 1 : 0, id])
      if (locked) {
        await execute('DELETE FROM sessions WHERE user_id = ?', [id])
      }
    }

    if (permissions !== undefined || role !== undefined) {
      const newRole = (role ?? existingRole) as User['role']
      if (newRole === 'customer') {
        return NextResponse.json({ error: 'Cannot set permissions for customer accounts' }, { status: 400 })
      }

      if (role !== undefined && role !== existingRole) {
        if (requester.role !== 'admin') {
          return NextResponse.json({ error: 'Only administrators can change user roles' }, { status: 403 })
        }
        if (id === requester.id) {
          return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
        }
        if (!['staff', 'admin'].includes(newRole)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }
        if (existingRole === 'admin' && newRole === 'staff') {
          const adminCount = await queryOne<{ count: number }>(
            `SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`
          )
          if ((adminCount?.count ?? 0) <= 1) {
            return NextResponse.json(
              { error: 'Cannot demote the only administrator account' },
              { status: 400 }
            )
          }
        }
      }

      const permsJson = resolvePermissions(newRole, permissions)
      const roleChanged = role !== undefined && role !== existingRole

      if (roleChanged) {
        await execute('UPDATE users SET role = ?, permissions = ?, access_locked = ? WHERE id = ?', [
          newRole,
          permsJson,
          newRole === 'admin' ? 0 : existing.access_locked ?? 0,
          id,
        ])
      } else if (permissions !== undefined) {
        await execute('UPDATE users SET permissions = ? WHERE id = ?', [permsJson, id])
      }
    }

    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
    return NextResponse.json({ user: serializeUser(updated!, requester.role === 'admin') })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const requester = requirePermission(
      await getUserBySession(getTokenFromRequest(request)),
      'users_manage'
    )
    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can delete accounts' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (id === requester.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const existing = await queryOne<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    )

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (existing.role === 'admin') {
      const adminCount = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`
      )
      if ((adminCount?.count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot delete the only administrator account' }, { status: 400 })
      }
    }

    await execute('DELETE FROM sessions WHERE user_id = ?', [id])
    await execute('UPDATE staff_records SET user_id = NULL, updated_at = ? WHERE user_id = ?', [
      new Date().toISOString(),
      id,
    ])
    await execute('DELETE FROM users WHERE id = ?', [id])

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const rows = await query<Record<string, unknown>>(
      `SELECT id, user_id, user_name, items, total, status, created_at, order_id
       FROM bulk_order_confirmations
       ORDER BY created_at DESC
       LIMIT 50`
    )

    const confirmations = rows.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      items: JSON.parse(row.items as string),
      total: row.total as number,
      status: row.status as string,
      createdAt: row.created_at as string,
      orderId: (row.order_id as string | null) || undefined,
    }))

    return NextResponse.json({ confirmations })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

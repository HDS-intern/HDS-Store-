import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import type { User } from '@/lib/types'

export const runtime = 'nodejs'

function canViewOrders(user: User) {
  return (
    hasPermission(user, 'dashboard') ||
    hasPermission(user, 'orders_view') ||
    hasPermission(user, 'orders_manage') ||
    hasPermission(user, 'payments_view') ||
    hasPermission(user, 'payments_manage')
  )
}

function parseOrderRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    items: JSON.parse(row.items as string),
    total: row.total as number,
    status: row.status as string,
    paymentStatus: row.payment_status as string,
    paymentMethod: (row.payment_method as string | null) ?? undefined,
    shippingAddress: row.shipping_address as string,
    createdAt: row.created_at as string,
    trackingNumber: (row.tracking_number as string | null) ?? undefined,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = requireStaffAccess(await getUserBySession(getTokenFromRequest(_request)))
    if (!canViewOrders(user)) {
      throw new Error('Unauthorized')
    }

    const { userId } = await params

    const customer = await queryOne<{
      id: string
      username: string
      email: string
      name: string
      role: string
      phone: string | null
      created_at: string
    }>(
      `SELECT id, username, email, name, role, phone, created_at
       FROM users WHERE id = ?`,
      [userId]
    )

    const orderRows = await query<Record<string, unknown>>(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    )

    const orders = orderRows.map(parseOrderRow)

    const paymentMethods = [
      ...new Set(
        orders
          .map((o) => o.paymentMethod)
          .filter((method): method is string => Boolean(method))
      ),
    ]

    const latestOrder = orders[0]

    if (!customer && userId !== 'guest') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({
      profile: customer
        ? {
            id: customer.id,
            username: customer.username,
            email: customer.email,
            name: customer.name,
            phone: customer.phone ?? undefined,
            role: customer.role,
            accountCreatedAt: customer.created_at,
          }
        : {
            id: 'guest',
            username: 'guest',
            email: '—',
            name: 'Guest Customer',
            role: 'customer',
            accountCreatedAt: latestOrder?.createdAt ?? null,
          },
      orders,
      paymentMethods,
      preferredPaymentMethod: latestOrder?.paymentMethod ?? paymentMethods[0] ?? null,
      orderCount: orders.length,
      totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

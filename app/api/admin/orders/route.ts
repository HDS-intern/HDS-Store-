import { NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requirePermission, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { syncInvoicePaymentStatus } from '@/lib/invoices'
import type { User } from '@/lib/types'

export const runtime = 'nodejs'

function canViewOrders(user: User) {
  return (
    hasPermission(user, 'orders_view') ||
    hasPermission(user, 'orders_manage') ||
    hasPermission(user, 'payments_view') ||
    hasPermission(user, 'payments_manage')
  )
}

export async function PATCH(request: Request) {
  try {
    const user = requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    const { id, status, paymentStatus, authorized, trackingNumber } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    if (status !== undefined || authorized !== undefined || trackingNumber !== undefined) {
      requirePermission(user, 'orders_manage')
    }
    if (paymentStatus !== undefined) {
      requirePermission(user, 'payments_manage')
    }

    const row = await queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ?', [id])
    if (!row) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updates: string[] = []
    const values: unknown[] = []

    const nextStatus = status !== undefined ? (status as string) : (row.status as string)
    const currentPayment = row.payment_status as string

    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)

      if (status === 'cancelled') {
        updates.push('authorized = ?')
        values.push(0)
        const items = JSON.parse(row.items as string) as { quantity?: number }[]
        const totalQty = Array.isArray(items)
          ? items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
          : 0
        updates.push('returned_qty = ?')
        values.push(totalQty)
        if (paymentStatus === undefined) {
          updates.push('payment_status = ?')
          values.push(currentPayment === 'paid' ? 'refunded' : 'failed')
        }
      }
    }
    if (paymentStatus !== undefined) {
      updates.push('payment_status = ?')
      values.push(paymentStatus)

      if (
        (paymentStatus === 'failed' || paymentStatus === 'refunded') &&
        status === undefined &&
        nextStatus !== 'cancelled'
      ) {
        updates.push('authorized = ?')
        values.push(0)
      }
    }
    if (authorized !== undefined && status !== 'cancelled') {
      updates.push('authorized = ?')
      values.push(authorized ? 1 : 0)
    }
    if (trackingNumber !== undefined) {
      updates.push('tracking_number = ?')
      values.push(trackingNumber)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    values.push(id)
    await execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values)

    if (paymentStatus !== undefined) {
      await syncInvoicePaymentStatus(id, paymentStatus as string)
    }

    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM orders WHERE id = ?', [id])
    return NextResponse.json({
      order: {
        id: updated!.id,
        userId: updated!.user_id,
        items: JSON.parse(updated!.items as string),
        total: updated!.total,
        status: updated!.status,
        paymentStatus: updated!.payment_status,
        authorized: Boolean(updated!.authorized),
        paymentMethod: updated!.payment_method,
        shippingAddress: updated!.shipping_address,
        deliveryMethod: updated!.delivery_method,
        trackingNumber: updated!.tracking_number,
        createdAt: updated!.created_at,
        deliveryDate: updated!.delivery_date,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function GET(request: Request) {
  try {
    const user = requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    if (!canViewOrders(user)) {
      throw new Error('Unauthorized')
    }
    const rows = await query<Record<string, unknown>>(`
      SELECT o.*, u.name AS customer_name, u.username AS customer_username
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `)
    const orders = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      customerName: (row.customer_name as string | null) ?? undefined,
      customerUsername: (row.customer_username as string | null) ?? undefined,
      items: JSON.parse(row.items as string),
      total: row.total,
      status: row.status,
      paymentStatus: row.payment_status,
      authorized: Boolean(row.authorized),
      paymentMethod: row.payment_method,
      shippingAddress: row.shipping_address,
      deliveryMethod: row.delivery_method,
      trackingNumber: row.tracking_number,
      createdAt: row.created_at,
      deliveryDate: row.delivery_date,
    }))
    return NextResponse.json({ orders })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

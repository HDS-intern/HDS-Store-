import { NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { getUserBySession, getTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

type ConfirmItem = {
  modelNumber: string
  qty: number
  productId: string
  productName: string
  price: number
}

export async function POST(request: Request) {
  try {
    const user = await getUserBySession(getTokenFromRequest(request))
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { items, orderId } = (await request.json()) as {
      items: ConfirmItem[]
      orderId?: string
    }

    if (!items?.length) {
      return NextResponse.json({ error: 'No valid items to confirm' }, { status: 400 })
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    const id = `BULK-${Date.now()}`
    const now = new Date().toISOString()

    await execute(
      `INSERT INTO bulk_order_confirmations (id, user_id, user_name, items, total, status, created_at, order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, user.name, JSON.stringify(items), total, 'paid', now, orderId]
    )

    return NextResponse.json({
      confirmationId: id,
      orderId,
      total,
      itemCount: items.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

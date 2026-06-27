import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { createReturnRequest } from '@/lib/returnRequests'
import { validateUploadFile } from '@/lib/uploadValidation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getUserBySession(getTokenFromRequest(request))
    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const orderId = String(formData.get('orderId') ?? '').trim()
    const productId = String(formData.get('productId') ?? '').trim()
    const reason = String(formData.get('reason') ?? '').trim()
    const agreed = String(formData.get('agreed') ?? '') === 'true'
    const file = formData.get('file')

    if (!orderId || !productId || !reason) {
      return NextResponse.json(
        { error: 'Order, product, and return reason are required' },
        { status: 400 }
      )
    }

    if (!agreed) {
      return NextResponse.json({ error: 'You must agree to the return policy' }, { status: 400 })
    }

    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'Please describe the return reason in at least 10 characters' },
        { status: 400 }
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Supporting document is required' }, { status: 400 })
    }

    const fileError = validateUploadFile(file)
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 })
    }

    const order = await queryOne<Record<string, unknown>>(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, user.id]
    )

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Cancelled orders cannot be returned' }, { status: 400 })
    }

    if (order.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Returns require a paid order' }, { status: 400 })
    }

    const items = JSON.parse(order.items as string) as { productId?: string; quantity?: number }[]
    const line = Array.isArray(items) ? items.find((item) => item.productId === productId) : undefined
    if (!line) {
      return NextResponse.json({ error: 'Product not found in this order' }, { status: 400 })
    }

    const productRow = await queryOne<{ data: string }>('SELECT data FROM products WHERE id = ?', [
      productId,
    ])
    const productName = productRow
      ? ((JSON.parse(productRow.data) as { name?: string }).name ?? productId)
      : productId

    const buffer = Buffer.from(await file.arrayBuffer())
    const returnRequest = await createReturnRequest({
      userId: user.id,
      orderId,
      productId,
      productName,
      customerName: user.name,
      customerEmail: user.email,
      reason,
      documentBuffer: buffer,
      documentName: file.name,
    })

    return NextResponse.json({ success: true, returnRequest })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to submit return request'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

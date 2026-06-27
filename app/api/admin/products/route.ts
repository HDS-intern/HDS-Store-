import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { queryOne, execute, getAllProducts } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requirePermission, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import type { Product } from '@/lib/types'

export const runtime = 'nodejs'

async function getAdminUser(request: Request) {
  const token = getTokenFromRequest(request)
  const user = await getUserBySession(token)
  return requireStaffAccess(user)
}

export async function GET(request: Request) {
  try {
    const user = await getAdminUser(request)
    if (!hasPermission(user, 'inventory_view') && !hasPermission(user, 'inventory_manage')) {
      throw new Error('Unauthorized')
    }
    return NextResponse.json({ products: await getAllProducts() })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'inventory_manage')
    const product = (await request.json()) as Product

    if (!product.name || product.price == null) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 })
    }

    if (!product.modelId?.trim()) {
      return NextResponse.json({ error: 'SKU ID is required' }, { status: 400 })
    }

    if (!product.manufacturingId?.trim()) {
      return NextResponse.json({ error: 'Manufacturing ID is required' }, { status: 400 })
    }

    const id = product.id || randomUUID()
    const stock = product.stock ?? 0
    const fullProduct: Product = {
      ...product,
      id,
      stock,
      inStock: stock > 0,
      modelId: product.modelId.trim(),
      manufacturingId: product.manufacturingId.trim(),
      brand: product.brand || 'Hawking Defence',
      images: product.images?.length ? product.images : [product.image],
      features: product.features || [],
      specs: product.specs || {},
      inTheBox: product.inTheBox || [],
      reviewList: product.reviewList || [],
      warranty: product.warranty || {
        duration: '1 Year',
        type: 'Standard',
        coverage: ['Manufacturing defects'],
        exclusions: ['Physical damage'],
        extendedAvailable: false,
      },
      shipping: product.shipping || {
        freeShipping: true,
        deliveryTime: '3-5 days',
        regions: ['Worldwide'],
      },
      support: product.support || {
        phone: '+1 (234) 567-890',
        email: 'support@hawking.com',
        documentation: 'https://docs.hawking.com',
      },
      longDescription: product.longDescription || product.description || '',
    }

    const now = new Date().toISOString()
    await execute('INSERT INTO products (id, data, stock, updated_at) VALUES (?, ?, ?, ?)', [
      id,
      JSON.stringify(fullProduct),
      stock,
      now,
    ])

    return NextResponse.json({ product: { ...fullProduct, stock, inStock: stock > 0 } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'inventory_manage')
    const { id, ...updates } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    const row = await queryOne<{ data: string; stock: number }>(
      'SELECT data, stock FROM products WHERE id = ?',
      [id]
    )

    if (!row) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const existing = JSON.parse(row.data) as Product
    const stock = updates.stock ?? row.stock
    const merged = { ...existing, ...updates, id, stock, inStock: stock > 0 }
    const modelId = (merged.modelId ?? (merged as Product & { sku?: string }).sku ?? '').trim()
    const manufacturingId = (merged.manufacturingId ?? '').trim()

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
    }

    if (!manufacturingId) {
      return NextResponse.json({ error: 'Manufacturing ID is required' }, { status: 400 })
    }

    const updated: Product = {
      ...merged,
      modelId,
      manufacturingId,
    }

    await execute('UPDATE products SET data = ?, stock = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(updated),
      stock,
      new Date().toISOString(),
      id,
    ])

    return NextResponse.json({ product: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'inventory_manage')
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

    await execute('DELETE FROM products WHERE id = ?', [id])
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

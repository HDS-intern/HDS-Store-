import { NextResponse } from 'next/server'
import { getAllProducts } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const products = await getAllProducts()
    return NextResponse.json(
      { products },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

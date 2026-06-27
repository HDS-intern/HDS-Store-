import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  addCertification,
  deleteCertification,
  getCertifications,
} from '@/lib/certifications'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    return NextResponse.json({ certifications: await getCertifications() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const body = await request.json()
    const type = String(body.type ?? '').trim()
    const logoUrl = String(body.logoUrl ?? '').trim()
    const imageUrl = String(body.imageUrl ?? '').trim()
    const productId = String(body.productId ?? '').trim()
    const productName = String(body.productName ?? '').trim()

    if (!type) {
      return NextResponse.json({ error: 'Certification type is required' }, { status: 400 })
    }
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }
    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }
    if (!logoUrl) {
      return NextResponse.json({ error: 'Certification logo is required' }, { status: 400 })
    }
    if (!imageUrl) {
      return NextResponse.json({ error: 'Certification image is required' }, { status: 400 })
    }

    const certification = await addCertification({ type, logoUrl, imageUrl, productId, productName })
    return NextResponse.json({ success: true, certification })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Certification id is required' }, { status: 400 })
    }
    if (!(await deleteCertification(id))) {
      return NextResponse.json({ error: 'Certification not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

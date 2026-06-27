import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  addCertificationType,
  deleteCertificationType,
  getCertificationTypes,
  updateCertificationType,
} from '@/lib/certificationTypes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    return NextResponse.json({ certificationTypes: await getCertificationTypes() })
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

    if (!type) {
      return NextResponse.json({ error: 'Certification type is required' }, { status: 400 })
    }
    if (!logoUrl) {
      return NextResponse.json({ error: 'Certification logo is required' }, { status: 400 })
    }

    const certificationType = await addCertificationType({ type, logoUrl })
    return NextResponse.json({ success: true, certificationType })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : msg.includes('already exists') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const body = await request.json()
    const id = String(body.id ?? '').trim()
    const type = String(body.type ?? '').trim()
    const logoUrl = String(body.logoUrl ?? '').trim()

    if (!id) {
      return NextResponse.json({ error: 'Certification type id is required' }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: 'Certification type is required' }, { status: 400 })
    }
    if (!logoUrl) {
      return NextResponse.json({ error: 'Certification logo is required' }, { status: 400 })
    }

    const certificationType = await updateCertificationType(id, { type, logoUrl })
    if (!certificationType) {
      return NextResponse.json({ error: 'Certification type not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, certificationType })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : msg.includes('already exists') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Certification type id is required' }, { status: 400 })
    }
    if (!(await deleteCertificationType(id))) {
      return NextResponse.json({ error: 'Certification type not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

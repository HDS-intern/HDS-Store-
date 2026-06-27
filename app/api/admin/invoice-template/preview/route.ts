import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import { getInvoiceTemplatePreviewMeta } from '@/lib/documentTemplatePreview'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    return NextResponse.json(getInvoiceTemplatePreviewMeta())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

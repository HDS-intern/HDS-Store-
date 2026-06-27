import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  getTermsAgreementPreviewMeta,
  getTermsAgreementStreamResponse,
} from '@/lib/termsAgreementPreview'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin', 'staff', 'customer'])

    const { searchParams } = new URL(request.url)
    if (searchParams.get('stream') === '1') {
      const stream = getTermsAgreementStreamResponse()
      return new NextResponse(stream.body, {
        headers: {
          'Content-Type': stream.contentType,
          'Content-Disposition': stream.disposition,
        },
      })
    }

    return NextResponse.json(getTermsAgreementPreviewMeta())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

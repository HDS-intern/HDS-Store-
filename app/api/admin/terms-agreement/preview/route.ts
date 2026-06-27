import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  getTermsAgreementPreviewMeta,
  getTermsAgreementStreamResponse,
} from '@/lib/termsAgreementPreview'

export const runtime = 'nodejs'

async function assertAdmin(request: Request) {
  requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
}

export async function GET(request: Request) {
  try {
    await assertAdmin(request)
    const { searchParams } = new URL(request.url)
    const stream = searchParams.get('stream') === '1'

    if (stream) {
      const streamResponse = getTermsAgreementStreamResponse()
      return new NextResponse(streamResponse.body, {
        headers: {
          'Content-Type': streamResponse.contentType,
          'Content-Disposition': streamResponse.disposition,
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

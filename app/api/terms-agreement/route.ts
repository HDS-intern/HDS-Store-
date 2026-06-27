import { NextResponse } from 'next/server'
import fs from 'fs'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  defaultTermsAgreementCsv,
  resolveTermsAgreementFile,
  termsAgreementContentType,
} from '@/lib/termsAgreement'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin', 'staff', 'customer'])

    const resolved = resolveTermsAgreementFile()
    if (resolved) {
      const buffer = fs.readFileSync(resolved.path)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': termsAgreementContentType(resolved.ext),
          'Content-Disposition': `attachment; filename="${resolved.filename}"`,
        },
      })
    }

    const csv = defaultTermsAgreementCsv()
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="hds-terms-and-agreement.csv"',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

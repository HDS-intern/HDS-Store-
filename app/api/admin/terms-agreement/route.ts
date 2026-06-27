import { NextResponse } from 'next/server'
import fs from 'fs'
import * as XLSX from 'xlsx'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  defaultTermsAgreementCsv,
  resolveTermsAgreementFile,
  saveTermsAgreementFile,
  termsAgreementContentType,
} from '@/lib/termsAgreement'

export const runtime = 'nodejs'

async function assertAdmin(request: Request) {
  requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
}

function buildDownloadResponse() {
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
}

export async function GET(request: Request) {
  try {
    await assertAdmin(request)
    return buildDownloadResponse()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    await assertAdmin(request)
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf') && !name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only .pdf, .xlsx, and .csv files are allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (name.endsWith('.xlsx')) {
      try {
        XLSX.read(buffer, { type: 'buffer' })
      } catch {
        return NextResponse.json({ error: 'Invalid or corrupted .xlsx file' }, { status: 400 })
      }
    }

    if (name.endsWith('.pdf') && buffer.length < 5) {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 })
    }

    saveTermsAgreementFile(buffer, file.name)

    return NextResponse.json({ success: true, filename: file.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : msg.includes('allowed') ? 400 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

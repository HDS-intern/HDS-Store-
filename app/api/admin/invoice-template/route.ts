import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import { invoiceTemplateCsv, invoiceTemplateMatrix } from '@/lib/invoiceTemplate'

export const runtime = 'nodejs'

const TEMPLATE_DIR = path.join(process.cwd(), 'data', 'templates')
const CUSTOM_XLSX = path.join(TEMPLATE_DIR, 'invoice-template.xlsx')
const CUSTOM_CSV = path.join(TEMPLATE_DIR, 'invoice-template.csv')
const PUBLIC_CSV = path.join(process.cwd(), 'public', 'templates', 'invoice-template.csv')
const DEFAULT_XLSX = path.join(process.cwd(), 'Hawking_Defence_Invoice.xlsx')

function buildWorkbook() {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(invoiceTemplateMatrix())
  XLSX.utils.book_append_sheet(workbook, sheet, 'Invoice Template')
  return workbook
}

async function assertAdmin(request: Request) {
  requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
}

export async function GET(request: Request) {
  try {
    await assertAdmin(request)
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'xlsx'

    if (format === 'csv') {
      const csv = fs.existsSync(CUSTOM_CSV)
        ? fs.readFileSync(CUSTOM_CSV, 'utf-8')
        : fs.readFileSync(PUBLIC_CSV, 'utf-8')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="hds-invoice-template.csv"',
        },
      })
    }

    if (fs.existsSync(CUSTOM_XLSX)) {
      const buffer = fs.readFileSync(CUSTOM_XLSX)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="hds-invoice-template.xlsx"',
        },
      })
    }

    if (fs.existsSync(DEFAULT_XLSX)) {
      const buffer = fs.readFileSync(DEFAULT_XLSX)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="hds-invoice-template.xlsx"',
        },
      })
    }

    const buffer = XLSX.write(buildWorkbook(), { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="hds-invoice-template.xlsx"',
      },
    })
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
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only .xlsx and .csv files are allowed' }, { status: 400 })
    }

    fs.mkdirSync(TEMPLATE_DIR, { recursive: true })
    fs.mkdirSync(path.dirname(PUBLIC_CSV), { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())

    if (name.endsWith('.xlsx')) {
      fs.writeFileSync(CUSTOM_XLSX, buffer)
      try {
        XLSX.read(buffer, { type: 'buffer' })
      } catch {
        fs.unlinkSync(CUSTOM_XLSX)
        return NextResponse.json({ error: 'Invalid or corrupted .xlsx file' }, { status: 400 })
      }
    } else {
      fs.writeFileSync(CUSTOM_CSV, buffer)
      fs.writeFileSync(PUBLIC_CSV, buffer)
    }

    return NextResponse.json({ success: true, filename: file.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

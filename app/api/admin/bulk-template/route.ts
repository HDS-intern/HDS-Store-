import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'

export const runtime = 'nodejs'

const TEMPLATE_DIR = path.join(process.cwd(), 'data', 'templates')
const CUSTOM_TEMPLATE = path.join(TEMPLATE_DIR, 'bulk-order-template.xlsx')

export async function POST(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
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
    const buffer = Buffer.from(await file.arrayBuffer())

    if (name.endsWith('.xlsx')) {
      fs.writeFileSync(CUSTOM_TEMPLATE, buffer)
    } else {
      fs.writeFileSync(path.join(TEMPLATE_DIR, 'bulk-order-template.csv'), buffer)
      fs.copyFileSync(path.join(TEMPLATE_DIR, 'bulk-order-template.csv'), path.join(process.cwd(), 'public', 'templates', 'bulk-order-template.csv'))
    }

    return NextResponse.json({ success: true, filename: file.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

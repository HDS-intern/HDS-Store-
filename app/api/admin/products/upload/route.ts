import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import { validateUploadFile } from '@/lib/uploadValidation'

export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products')

export async function POST(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'inventory_manage')
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validationError = validateUploadFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, { status: 400 })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const filename = `product-${randomBytes(8).toString('hex')}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)

    return NextResponse.json({ success: true, url: `/uploads/products/${filename}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

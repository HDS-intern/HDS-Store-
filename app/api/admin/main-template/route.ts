import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import {
  getMainTemplate,
  saveMainTemplate,
  type MainTemplate,
} from '@/lib/mainTemplate'

export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'home')

export async function GET(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const template = await getMainTemplate()
    return NextResponse.json({ template })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const body = await request.json()
    const template = body.template as MainTemplate

    if (!template?.slides?.length) {
      return NextResponse.json({ error: 'At least one slideshow slide is required' }, { status: 400 })
    }

    await saveMainTemplate(template)
    return NextResponse.json({ success: true, template: await getMainTemplate() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith('.jpg') && !name.endsWith('.jpeg') && !name.endsWith('.png') && !name.endsWith('.webp')) {
      return NextResponse.json({ error: 'Only .jpg, .png, and .webp images are allowed' }, { status: 400 })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const ext = path.extname(file.name).toLowerCase() || '.png'
    const filename = `home-${randomBytes(8).toString('hex')}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)

    return NextResponse.json({ success: true, url: `/uploads/home/${filename}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

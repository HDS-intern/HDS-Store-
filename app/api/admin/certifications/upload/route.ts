import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { getUserBySession, getTokenFromRequest, requireRole } from '@/lib/auth'
import { fileExtension, validateUploadFile } from '@/lib/uploadValidation'

export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'certifications')

const LOGO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png'])

export async function POST(request: Request) {
  try {
    requireRole(await getUserBySession(getTokenFromRequest(request)), ['admin'])
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kind = String(formData.get('kind') ?? 'logo')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validationError = validateUploadFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const ext = fileExtension(file.name)
    const allowed = kind === 'logo' ? LOGO_EXTENSIONS : DOCUMENT_EXTENSIONS
    if (!allowed.has(ext)) {
      return NextResponse.json(
        {
          error:
            kind === 'logo'
              ? 'Logo must be JPG or PNG'
              : 'Certification image must be PDF, JPG, or PNG',
        },
        { status: 400 }
      )
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const prefix = kind === 'logo' ? 'logo' : 'doc'
    const filename = `${prefix}-${randomBytes(8).toString('hex')}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)

    return NextResponse.json({ success: true, url: `/uploads/certifications/${filename}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

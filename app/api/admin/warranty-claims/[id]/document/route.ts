import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import { getWarrantyClaimDocument } from '@/lib/warrantyClaims'

export const runtime = 'nodejs'

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'dashboard')
    const { id } = await params
    const doc = await getWarrantyClaimDocument(id)

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const ext = path.extname(doc.name).toLowerCase()
    const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream'
    const buffer = fs.readFileSync(doc.path)
    const url = new URL(request.url)
    const download = url.searchParams.get('download') === '1'
    const disposition = download ? 'attachment' : 'inline'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${doc.name.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

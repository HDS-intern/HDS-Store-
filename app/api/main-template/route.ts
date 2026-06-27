import { NextResponse } from 'next/server'
import { getMainTemplate } from '@/lib/mainTemplate'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const template = await getMainTemplate()
    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ error: 'Failed to load main template' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import { buildAdminReport } from '@/lib/adminReports'
import type { DateRangePreset, SalesPeriod } from '@/lib/adminReportTypes'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'dashboard')
    const { searchParams } = new URL(request.url)
    const preset = (searchParams.get('preset') || 'last30') as DateRangePreset
    const period = (searchParams.get('period') || 'monthly') as SalesPeriod
    const customStart = searchParams.get('start') || undefined
    const customEnd = searchParams.get('end') || undefined
    const orderStatus = searchParams.get('orderStatus') || 'all'

    const report = await buildAdminReport(
      preset,
      period,
      customStart,
      customEnd,
      orderStatus
    )

    return NextResponse.json({ report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import { buildSalesChartData } from '@/lib/dashboardSalesChart'
import { buildDashboardOverviewExtras } from '@/lib/dashboardOverview'
import { ensureDailyAbsences } from '@/lib/staffAttendance'
import type { DashboardStats } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'dashboard')
    const today = new Date().toISOString().slice(0, 10)
    await ensureDailyAbsences(today)

    const productCount = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM products')
    const orderStats = await queryOne<{
      total: number
      revenue: number
      pending_orders: number
      pending_payments: number
    }>(`
      SELECT
        SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) as total,
        COALESCE(SUM(
          CASE
            WHEN status != 'cancelled' AND payment_status = 'paid' THEN total
            ELSE 0
          END
        ), 0) as revenue,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(
          CASE
            WHEN status != 'cancelled' AND payment_status = 'pending' THEN 1
            ELSE 0
          END
        ) as pending_payments
      FROM orders
    `)

    const liveStaff = await queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM staff_records WHERE work_status = 'live'"
    )

    const presentToday = await queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM staff_attendance WHERE date = ? AND status = 'present' AND check_in IS NOT NULL",
      [today]
    )

    const salesChart = await buildSalesChartData()
    const overview = await buildDashboardOverviewExtras()

    const attendanceRows = await query<{
      id: string
      staff_id: string
      date: string
      status: string
      check_in: string | null
      check_out: string | null
      employee_name: string
    }>(`
      SELECT a.id, a.staff_id, a.date, a.status, a.check_in, a.check_out, s.employee_name
      FROM staff_attendance a
      JOIN staff_records s ON s.id = a.staff_id
      WHERE a.date = ?
      ORDER BY a.check_in ASC
    `, [today])

    const stats: DashboardStats = {
      totalProducts: productCount?.c ?? 0,
      totalOrders: orderStats?.total ?? 0,
      totalRevenue: orderStats?.revenue ?? 0,
      pendingOrders: orderStats?.pending_orders ?? 0,
      pendingPayments: orderStats?.pending_payments ?? 0,
      liveStaff: liveStaff?.c ?? 0,
      presentToday: presentToday?.c ?? 0,
      salesChart,
      attendanceToday: attendanceRows.map((r) => ({
        id: r.id,
        staffId: r.staff_id,
        employeeName: r.employee_name,
        date: r.date,
        status: r.status as 'present' | 'absent' | 'leave',
        checkIn: r.check_in ?? undefined,
        checkOut: r.check_out ?? undefined,
      })),
      ...overview,
    }

    return NextResponse.json(stats)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

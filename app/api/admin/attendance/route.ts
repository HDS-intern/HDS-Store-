import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { query, queryOne, execute } from '@/lib/db'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import { ensureDailyAbsences, ensureMonthAbsences } from '@/lib/staffAttendance'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'staff_records')
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const month = searchParams.get('month')
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

    if (staffId && month) {
      await ensureMonthAbsences(month)

      const rows = await query<{
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
        WHERE a.staff_id = ? AND a.date LIKE ?
        ORDER BY a.date ASC
      `, [staffId, `${month}%`])

      return NextResponse.json({
        attendance: rows.map((r) => ({
          id: r.id,
          staffId: r.staff_id,
          employeeName: r.employee_name,
          date: r.date,
          status: r.status,
          checkIn: r.check_in ?? undefined,
          checkOut: r.check_out ?? undefined,
        })),
        month,
        staffId,
      })
    }

    await ensureDailyAbsences(date)

    const rows = await query<{
      id: string
      staff_id: string
      date: string
      status: string
      check_in: string | null
      check_out: string | null
      employee_name: string
    }>(`
      SELECT a.*, s.employee_name
      FROM staff_attendance a
      JOIN staff_records s ON s.id = a.staff_id
      WHERE a.date = ?
      ORDER BY s.employee_name
    `, [date])

    return NextResponse.json({
      attendance: rows.map((r) => ({
        id: r.id,
        staffId: r.staff_id,
        employeeName: r.employee_name,
        date: r.date,
        status: r.status,
        checkIn: r.check_in ?? undefined,
        checkOut: r.check_out ?? undefined,
      })),
      date,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'staff_records')
    const { staffId, date, status, checkIn, checkOut } = await request.json()
    const attDate = date || new Date().toISOString().slice(0, 10)

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM staff_attendance WHERE staff_id = ? AND date = ?',
      [staffId, attDate]
    )

    if (existing) {
      await execute(
        'UPDATE staff_attendance SET status = ?, check_in = ?, check_out = ? WHERE staff_id = ? AND date = ?',
        [status, checkIn || null, checkOut || null, staffId, attDate]
      )
    } else {
      await execute(
        'INSERT INTO staff_attendance (id, staff_id, date, status, check_in, check_out) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), staffId, attDate, status, checkIn || null, checkOut || null]
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

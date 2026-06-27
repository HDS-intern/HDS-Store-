import { randomUUID } from 'crypto'
import { query, queryOne, execute } from './db'

export function formatAttendanceTime(date = new Date()): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getStaffRecordIdForUser(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM staff_records
     WHERE user_id = ? AND work_status = 'live'`,
    [userId]
  )
  return row?.id ?? null
}

export async function recordStaffLogin(userId: string): Promise<void> {
  const staffId = await getStaffRecordIdForUser(userId)
  if (!staffId) return

  const date = todayDateString()
  const loginTime = formatAttendanceTime()

  const existing = await queryOne<{ id: string; check_in: string | null }>(
    'SELECT id, check_in FROM staff_attendance WHERE staff_id = ? AND date = ?',
    [staffId, date]
  )

  if (existing) {
    if (!existing.check_in) {
      await execute(
        `UPDATE staff_attendance
         SET status = 'present', check_in = ?
         WHERE staff_id = ? AND date = ?`,
        [loginTime, staffId, date]
      )
    }
    return
  }

  await execute(
    `INSERT INTO staff_attendance (id, staff_id, date, status, check_in, check_out)
     VALUES (?, ?, ?, 'present', ?, NULL)`,
    [randomUUID(), staffId, date, loginTime]
  )
}

export async function recordStaffLogout(userId: string): Promise<void> {
  const staffId = await getStaffRecordIdForUser(userId)
  if (!staffId) return

  const date = todayDateString()
  const logoutTime = formatAttendanceTime()

  await execute(
    `UPDATE staff_attendance
     SET check_out = ?
     WHERE staff_id = ? AND date = ? AND check_in IS NOT NULL`,
    [logoutTime, staffId, date]
  )
}

export async function ensureDailyAbsences(date: string): Promise<void> {
  const today = todayDateString()
  if (date > today) return

  const liveStaff = await query<{ id: string }>(
    "SELECT id FROM staff_records WHERE work_status = 'live'"
  )

  for (const staff of liveStaff) {
    await execute(
      `INSERT INTO staff_attendance (id, staff_id, date, status, check_in, check_out)
       VALUES (?, ?, ?, 'absent', NULL, NULL)
       ON CONFLICT (staff_id, date) DO NOTHING`,
      [randomUUID(), staff.id, date]
    )
  }
}

export async function ensureMonthAbsences(month: string): Promise<void> {
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const mon = Number(monthStr)
  if (!year || !mon) return

  const daysInMonth = new Date(year, mon, 0).getDate()
  const today = todayDateString()

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (dateStr > today) break
    await ensureDailyAbsences(dateStr)
  }
}

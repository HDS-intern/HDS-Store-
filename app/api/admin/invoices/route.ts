import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { getAllInvoices } from '@/lib/invoices'
import type { User } from '@/lib/types'

export const runtime = 'nodejs'

function canViewInvoices(user: User) {
  return (
    hasPermission(user, 'orders_view') ||
    hasPermission(user, 'orders_manage') ||
    hasPermission(user, 'payments_view') ||
    hasPermission(user, 'payments_manage')
  )
}

export async function GET(request: Request) {
  try {
    const user = requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    if (!canViewInvoices(user)) {
      throw new Error('Unauthorized')
    }

    const invoices = await getAllInvoices()
    return NextResponse.json(
      { invoices },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

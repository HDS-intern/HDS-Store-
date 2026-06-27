import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { getInvoiceById } from '@/lib/invoices'
import type { User } from '@/lib/types'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

function canViewInvoices(user: User) {
  return (
    hasPermission(user, 'orders_view') ||
    hasPermission(user, 'orders_manage') ||
    hasPermission(user, 'payments_view') ||
    hasPermission(user, 'payments_manage')
  )
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireStaffAccess(await getUserBySession(getTokenFromRequest(request)))
    if (!canViewInvoices(user)) {
      throw new Error('Unauthorized')
    }

    const { id } = await context.params
    const invoice = await getInvoiceById(id)
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

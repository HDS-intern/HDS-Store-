import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requireStaffAccess } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { getInvoiceById } from '@/lib/invoices'
import { fillInvoiceWorkbook } from '@/lib/invoiceWorkbook'
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

type RouteContext = { params: Promise<{ id: string }> }

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

    const buffer = fillInvoiceWorkbook(invoice)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${invoice.id}.xlsx"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed'
    const status = msg === 'Unauthorized' ? 401 : msg.includes('not found') ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

import { query, queryOne, execute } from './db'
import { invoiceIdFromOrderId } from './invoiceIds'
import type { CartItem } from './types'

export type InvoiceRecord = {
  id: string
  orderId: string
  userId: string
  customerName?: string
  total: number
  paymentStatus: string
  paymentMethod?: string
  createdAt: string
}

export type InvoiceLineItem = {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type InvoiceDetail = InvoiceRecord & {
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: string
  orderStatus?: string
  items: InvoiceLineItem[]
}

async function mapInvoiceItems(rawItems: CartItem[]): Promise<InvoiceLineItem[]> {
  return Promise.all(
    rawItems.map(async (item) => {
      let productName = item.product?.name
      let unitPrice = item.product?.price ?? 0

      if (!productName) {
        const row = await queryOne<{ data: string }>(
          'SELECT data FROM products WHERE id = ?',
          [item.productId]
        )
        if (row) {
          const product = JSON.parse(row.data) as { name?: string; price?: number }
          productName = product.name
          unitPrice = product.price ?? 0
        }
      }

      return {
        productId: item.productId,
        productName: productName || item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      }
    })
  )
}

async function mapInvoiceRow(row: {
  id: string
  order_id: string
  user_id: string
  customer_name: string | null
  total: number
  payment_status: string
  payment_method: string | null
  created_at: string
  items: string
  shipping_address: string
  order_status: string
  email: string | null
  phone: string | null
  user_name: string | null
}): Promise<InvoiceDetail> {
  const items = await mapInvoiceItems(JSON.parse(row.items) as CartItem[])

  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    customerName: row.customer_name || row.user_name || undefined,
    total: row.total,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? undefined,
    createdAt: row.created_at,
    customerEmail: row.email ?? undefined,
    customerPhone: row.phone ?? undefined,
    shippingAddress: row.shipping_address,
    orderStatus: row.order_status,
    items,
  }
}

export async function createInvoiceForOrder(order: {
  id: string
  userId: string
  total: number
  paymentStatus?: string
  paymentMethod?: string
  createdAt: string | Date
  customerName?: string
}): Promise<void> {
  const createdAt =
    order.createdAt instanceof Date
      ? order.createdAt.toISOString()
      : new Date(order.createdAt).toISOString()

  const user = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [
    order.userId,
  ])

  await execute(
    `INSERT INTO invoices (id, order_id, user_id, customer_name, total, payment_status, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (order_id) DO NOTHING`,
    [
      invoiceIdFromOrderId(order.id),
      order.id,
      order.userId,
      order.customerName || user?.name || null,
      order.total,
      order.paymentStatus || 'pending',
      order.paymentMethod || null,
      createdAt,
    ]
  )
}

export async function syncInvoicePaymentStatus(
  orderId: string,
  paymentStatus: string
): Promise<void> {
  await execute('UPDATE invoices SET payment_status = ? WHERE order_id = ?', [
    paymentStatus,
    orderId,
  ])
}

export async function getInvoiceById(invoiceId: string): Promise<InvoiceDetail | null> {
  const row = await queryOne<{
    id: string
    order_id: string
    user_id: string
    customer_name: string | null
    total: number
    payment_status: string
    payment_method: string | null
    created_at: string
    items: string
    shipping_address: string
    order_status: string
    email: string | null
    phone: string | null
    user_name: string | null
  }>(
    `SELECT i.id, i.order_id, i.user_id, i.customer_name, i.total, i.payment_status, i.payment_method, i.created_at,
            o.items, o.shipping_address, o.status AS order_status,
            u.email, u.phone, u.name AS user_name
     FROM invoices i
     JOIN orders o ON o.id = i.order_id
     LEFT JOIN users u ON u.id = i.user_id
     WHERE i.id = ?`,
    [invoiceId]
  )

  return row ? mapInvoiceRow(row) : null
}

export async function getInvoiceByOrderId(orderId: string): Promise<InvoiceDetail | null> {
  const invoice = await queryOne<{ id: string }>(
    'SELECT id FROM invoices WHERE order_id = ?',
    [orderId]
  )
  return invoice ? getInvoiceById(invoice.id) : null
}

export async function getAllInvoices(): Promise<InvoiceRecord[]> {
  const rows = await query<{
    id: string
    order_id: string
    user_id: string
    customer_name: string | null
    total: number
    payment_status: string
    payment_method: string | null
    created_at: string
    user_name: string | null
  }>(
    `SELECT i.id, i.order_id, i.user_id, i.customer_name, i.total, i.payment_status, i.payment_method, i.created_at,
            u.name AS user_name
     FROM invoices i
     LEFT JOIN users u ON u.id = i.user_id
     ORDER BY i.created_at DESC`
  )

  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    customerName: row.customer_name || row.user_name || undefined,
    total: row.total,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method ?? undefined,
    createdAt: row.created_at,
  }))
}

export { invoiceIdFromOrderId }

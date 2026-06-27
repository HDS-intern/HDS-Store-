import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { query, execute } from './db'
import type { ReturnRequest } from './types'

export const RETURN_REQUESTS_DIR = path.join(process.cwd(), 'data', 'return-requests')

type ReturnRequestRow = {
  id: string
  user_id: string
  order_id: string
  product_id: string
  product_name: string
  customer_name: string
  customer_email: string
  reason: string
  document_path: string
  document_name: string
  created_at: string
}

function rowToReturn(row: ReturnRequestRow): ReturnRequest {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    reason: row.reason,
    documentName: row.document_name,
    createdAt: row.created_at,
  }
}

export async function listReturnRequests(): Promise<ReturnRequest[]> {
  const rows = await query<ReturnRequestRow>(
    'SELECT * FROM return_requests ORDER BY created_at DESC'
  )
  return rows.map(rowToReturn)
}

export async function createReturnRequest(input: {
  userId: string
  orderId: string
  productId: string
  productName: string
  customerName: string
  customerEmail: string
  reason: string
  documentBuffer: Buffer
  documentName: string
}): Promise<ReturnRequest> {
  const id = `RR-${Date.now()}${randomBytes(3).toString('hex')}`
  const createdAt = new Date().toISOString()

  fs.mkdirSync(RETURN_REQUESTS_DIR, { recursive: true })
  const ext = path.extname(input.documentName).toLowerCase() || '.bin'
  const storedName = `${id}${ext}`
  const documentPath = path.join(RETURN_REQUESTS_DIR, storedName)
  fs.writeFileSync(documentPath, input.documentBuffer)

  await execute(
    `INSERT INTO return_requests
     (id, user_id, order_id, product_id, product_name, customer_name, customer_email, reason, document_path, document_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.orderId,
      input.productId,
      input.productName.trim(),
      input.customerName.trim(),
      input.customerEmail.trim(),
      input.reason.trim(),
      documentPath,
      input.documentName.trim(),
      createdAt,
    ]
  )

  await execute(
    'UPDATE orders SET returned_qty = COALESCE(returned_qty, 0) + 1 WHERE id = ?',
    [input.orderId]
  )

  return {
    id,
    userId: input.userId,
    orderId: input.orderId,
    productId: input.productId,
    productName: input.productName.trim(),
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    reason: input.reason.trim(),
    documentName: input.documentName.trim(),
    createdAt,
  }
}

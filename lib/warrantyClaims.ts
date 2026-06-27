import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { query, queryOne, execute } from './db'
import type { WarrantyClaim } from './types'

export const WARRANTY_CLAIMS_DIR = path.join(process.cwd(), 'data', 'warranty-claims')

type WarrantyClaimRow = {
  id: string
  user_id: string
  order_id: string
  product_id: string
  product_name: string
  customer_name: string
  customer_email: string
  notes: string
  document_path: string
  document_name: string
  created_at: string
}

function rowToClaim(row: WarrantyClaimRow): WarrantyClaim {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    notes: row.notes,
    documentName: row.document_name,
    createdAt: row.created_at,
  }
}

export async function listWarrantyClaims(): Promise<WarrantyClaim[]> {
  const rows = await query<WarrantyClaimRow>(
    'SELECT * FROM warranty_claims ORDER BY created_at DESC'
  )
  return rows.map(rowToClaim)
}

export async function getWarrantyClaimDocument(id: string): Promise<{
  path: string
  name: string
} | null> {
  const row = await queryOne<{ document_path: string; document_name: string }>(
    'SELECT document_path, document_name FROM warranty_claims WHERE id = ?',
    [id]
  )

  if (!row || !fs.existsSync(row.document_path)) return null

  return { path: row.document_path, name: row.document_name }
}

export async function createWarrantyClaim(input: {
  userId: string
  orderId: string
  productId: string
  productName: string
  customerName: string
  customerEmail: string
  notes: string
  documentBuffer: Buffer
  documentName: string
}): Promise<WarrantyClaim> {
  const id = `WC-${Date.now()}${randomBytes(3).toString('hex')}`
  const createdAt = new Date().toISOString()

  fs.mkdirSync(WARRANTY_CLAIMS_DIR, { recursive: true })
  const ext = path.extname(input.documentName).toLowerCase() || '.bin'
  const storedName = `${id}${ext}`
  const documentPath = path.join(WARRANTY_CLAIMS_DIR, storedName)
  fs.writeFileSync(documentPath, input.documentBuffer)

  await execute(
    `INSERT INTO warranty_claims
     (id, user_id, order_id, product_id, product_name, customer_name, customer_email, notes, document_path, document_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.orderId,
      input.productId,
      input.productName.trim(),
      input.customerName.trim(),
      input.customerEmail.trim(),
      input.notes.trim(),
      documentPath,
      input.documentName.trim(),
      createdAt,
    ]
  )

  await execute(
    'UPDATE orders SET warranty_claim_qty = COALESCE(warranty_claim_qty, 0) + 1 WHERE id = ?',
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
    notes: input.notes.trim(),
    documentName: input.documentName.trim(),
    createdAt,
  }
}

import type { Product } from './types'

export type BulkOrderRow = {
  modelNumber: string
  qty: number
}

export type ParsedBulkLine = BulkOrderRow & {
  product?: Product
  error?: string
}

const MODEL_HEADERS = ['model id', 'model number', 'model', 'model no', 'modelno', 'sku', 'product sku']
const QTY_HEADERS = ['qty', 'quantity', 'qnty', 'count']

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(normalizeHeader(h)))
}

export function parseSheetRows(matrix: string[][]): BulkOrderRow[] {
  if (matrix.length === 0) return []

  const headerRow = matrix.find((row) => row.some((cell) => cell?.trim()))
  if (!headerRow) return []

  const headers = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))
  const modelIdx = findColumnIndex(headers, MODEL_HEADERS)
  const qtyIdx = findColumnIndex(headers, QTY_HEADERS)

  if (modelIdx === -1 || qtyIdx === -1) {
    throw new Error('Template must include "Model Number" and "Qty" columns.')
  }

  const startIndex = matrix.indexOf(headerRow) + 1
  const rows: BulkOrderRow[] = []

  for (let i = startIndex; i < matrix.length; i++) {
    const row = matrix[i]
    if (!row || row.every((cell) => !String(cell ?? '').trim())) continue

    const modelNumber = String(row[modelIdx] ?? '').trim()
    const qtyRaw = String(row[qtyIdx] ?? '').trim()
    const qty = parseInt(qtyRaw, 10)

    if (!modelNumber) continue
    if (!Number.isFinite(qty) || qty < 1) continue

    rows.push({ modelNumber, qty })
  }

  return rows
}

export function matchBulkRowsToProducts(rows: BulkOrderRow[], products: Product[]): ParsedBulkLine[] {
  return rows.map((row) => {
    const key = row.modelNumber.toLowerCase()
    const product = products.find(
      (p) =>
        p.modelId.toLowerCase() === key ||
        p.id.toLowerCase() === key ||
        p.name.toLowerCase() === key ||
        p.name.toLowerCase().includes(key)
    )

    if (!product) {
      return { ...row, error: 'Product not found' }
    }
    if (!product.inStock || product.stock < row.qty) {
      return { ...row, product, error: `Only ${product.stock} in stock` }
    }
    return { ...row, product }
  })
}

export const BULK_TEMPLATE_SAMPLE: BulkOrderRow[] = [
  { modelNumber: 'HDS-SNT-4K-001', qty: 2 },
  { modelNumber: 'HDS-GRD-X500-002', qty: 1 },
]

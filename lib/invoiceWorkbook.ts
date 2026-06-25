import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { formatPrice } from './formatPrice'
import type { InvoiceDetail } from './invoices'

const TEMPLATE_DIR = path.join(process.cwd(), 'data', 'templates')
const CUSTOM_XLSX = path.join(TEMPLATE_DIR, 'invoice-template.xlsx')
const CUSTOM_CSV = path.join(TEMPLATE_DIR, 'invoice-template.csv')
const DEFAULT_XLSX = path.join(process.cwd(), 'Hawking_Defence_Invoice.xlsx')

function formatInvoiceDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatPaymentMethod(method?: string) {
  if (!method) return '—'
  const base = method.split('|')[0].split('-')[0]
  const labels: Record<string, string> = {
    upi: 'UPI Payment',
    cod: 'Cash on Delivery',
    netbanking: 'Net Banking',
    card_transfer: 'Card / Bank Transfer',
    bulk_sheet: 'Bulk Order Sheet',
  }
  return labels[base] ?? base.replace(/_/g, ' ')
}

function placeholderMap(invoice: InvoiceDetail): Record<string, string> {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.lineTotal, 0)
  return {
    invoice_id: invoice.id,
    order_id: invoice.orderId,
    customer_name: invoice.customerName || invoice.userId,
    amount: String(invoice.total),
    amount_ind: formatPrice(invoice.total).replace(/^₹/, ''),
    payment_status: invoice.paymentStatus,
    payment_method: formatPaymentMethod(invoice.paymentMethod),
    generated_date: formatInvoiceDate(invoice.createdAt),
    customer_email: invoice.customerEmail || '',
    customer_phone: invoice.customerPhone || '',
    shipping_address: invoice.shippingAddress || '',
    order_status: invoice.orderStatus || '',
    subtotal: String(subtotal),
    grand_total: String(invoice.total),
  }
}

function replacePlaceholders(text: string, invoice: InvoiceDetail): string {
  const map = placeholderMap(invoice)
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => map[key.toLowerCase()] ?? '')
}

function setCellValue(sheet: XLSX.WorkSheet, row: number, col: number, value: string | number) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = sheet[addr]
  if (existing) {
    existing.v = value
    existing.t = typeof value === 'number' ? 'n' : 's'
  } else {
    sheet[addr] = { t: typeof value === 'number' ? 'n' : 's', v: value }
  }
}

function isHawkingTemplate(sheet: XLSX.WorkSheet): boolean {
  const title = sheet.B1?.v ?? sheet.A1?.v
  return typeof title === 'string' && title.toUpperCase().includes('HAWKING')
}

function fillHawkingTemplate(sheet: XLSX.WorkSheet, invoice: InvoiceDetail) {
  const customer = invoice.customerName || invoice.userId
  const address = invoice.shippingAddress || '—'
  const invoiceMeta = [
    `Invoice No: ${invoice.id}`,
    `Invoice Date: ${formatInvoiceDate(invoice.createdAt)}`,
    `Order ID: ${invoice.orderId}`,
    `Payment: ${invoice.paymentStatus} (${formatPaymentMethod(invoice.paymentMethod)})`,
    `Order Status: ${invoice.orderStatus || '—'}`,
  ].join('\n')

  if (sheet.E5) {
    sheet.E5.v = invoiceMeta
  }

  const billTo = [
    'BILL TO',
    '',
    `Customer Name: ${customer}`,
    `Address: ${address}`,
    invoice.customerEmail ? `Email: ${invoice.customerEmail}` : '',
    invoice.customerPhone ? `Phone: ${invoice.customerPhone}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shipTo = ['SHIP TO', '', `Customer Name: ${customer}`, `Address: ${address}`].join('\n')

  if (sheet.A12) sheet.A12.v = billTo
  if (sheet.E12) sheet.E12.v = shipTo

  const lineStartRow = 17
  const maxItemRows = 10

  for (let i = 0; i < maxItemRows; i++) {
    const row = lineStartRow + i
    ;[0, 1, 2, 3, 4, 5, 6, 7].forEach((col) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      if (sheet[addr]) delete sheet[addr]
    })
  }

  invoice.items.forEach((item, index) => {
    const row = lineStartRow + index
    setCellValue(sheet, row, 0, index + 1)
    setCellValue(sheet, row, 1, item.productName)
    setCellValue(sheet, row, 2, '')
    setCellValue(sheet, row, 3, item.quantity)
    setCellValue(sheet, row, 4, item.unitPrice)
    setCellValue(sheet, row, 5, '')
    setCellValue(sheet, row, 6, '')
    setCellValue(sheet, row, 7, item.lineTotal)
  })

  const subtotal = invoice.items.reduce((sum, item) => sum + item.lineTotal, 0)
  setCellValue(sheet, 28, 7, subtotal)
  setCellValue(sheet, 31, 7, invoice.total)
}

function isTabularInvoiceTemplate(sheet: XLSX.WorkSheet): boolean {
  for (let c = 0; c < 12; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const value = sheet[addr]?.v
    if (value && String(value).toLowerCase().includes('invoice id')) return true
  }
  return false
}

function fillTabularTemplate(sheet: XLSX.WorkSheet, invoice: InvoiceDetail) {
  setCellValue(sheet, 1, 0, invoice.id)
  setCellValue(sheet, 1, 1, invoice.orderId)
  setCellValue(sheet, 1, 2, invoice.customerName || invoice.userId)
  setCellValue(sheet, 1, 3, invoice.total)
  setCellValue(sheet, 1, 4, invoice.paymentStatus)
  setCellValue(sheet, 1, 5, formatPaymentMethod(invoice.paymentMethod))
  setCellValue(sheet, 1, 6, formatInvoiceDate(invoice.createdAt))
}

function fillAllPlaceholders(sheet: XLSX.WorkSheet, invoice: InvoiceDetail) {
  Object.keys(sheet).forEach((key) => {
    if (key.startsWith('!')) return
    const cell = sheet[key]
    if (!cell || cell.v == null) return
    if (typeof cell.v === 'string' && cell.v.includes('{{')) {
      cell.v = replacePlaceholders(cell.v, invoice)
    }
  })
}

export function resolveInvoiceTemplatePath(): string {
  if (fs.existsSync(CUSTOM_XLSX)) return CUSTOM_XLSX
  if (fs.existsSync(CUSTOM_CSV)) return CUSTOM_CSV
  if (fs.existsSync(DEFAULT_XLSX)) return DEFAULT_XLSX
  return CUSTOM_XLSX
}

export function hasUploadedInvoiceTemplate(): boolean {
  return fs.existsSync(CUSTOM_XLSX) || fs.existsSync(CUSTOM_CSV)
}

function readWorkbookFromPath(filePath: string): XLSX.WorkBook {
  const buffer = fs.readFileSync(filePath)
  return XLSX.read(buffer, { type: 'buffer' })
}

function loadTemplateWorkbook(): XLSX.WorkBook {
  const candidates: string[] = []
  if (fs.existsSync(CUSTOM_XLSX)) candidates.push(CUSTOM_XLSX)
  if (fs.existsSync(CUSTOM_CSV)) candidates.push(CUSTOM_CSV)
  if (fs.existsSync(DEFAULT_XLSX)) candidates.push(DEFAULT_XLSX)

  let lastError: Error | null = null

  for (const filePath of candidates) {
    try {
      if (filePath.endsWith('.csv')) {
        const csv = fs.readFileSync(filePath, 'utf-8')
        return XLSX.read(csv, { type: 'string' })
      }
      return readWorkbookFromPath(filePath)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Failed to read invoice template')
    }
  }

  throw lastError ?? new Error('Invoice template not found. Upload a template from Edit Template.')
}

export function fillInvoiceWorkbook(invoice: InvoiceDetail): Buffer {
  const workbook = loadTemplateWorkbook()
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  fillAllPlaceholders(sheet, invoice)

  if (isHawkingTemplate(sheet)) {
    fillHawkingTemplate(sheet, invoice)
  } else if (isTabularInvoiceTemplate(sheet)) {
    fillTabularTemplate(sheet, invoice)
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export type InvoiceTemplateRow = {
  invoiceId: string
  orderId: string
  customerName: string
  amount: number
  paymentStatus: string
  paymentMethod: string
  generatedDate: string
}

export const INVOICE_TEMPLATE_HEADERS = [
  'Invoice ID',
  'Order ID',
  'Customer Name',
  'Amount (₹)',
  'Payment Status',
  'Payment Method',
  'Generated Date',
] as const

export const INVOICE_TEMPLATE_SAMPLE: InvoiceTemplateRow[] = [
  {
    invoiceId: 'INV-1781776655103',
    orderId: 'ORD-1781776655103',
    customerName: 'Test Customer',
    amount: 47440.4,
    paymentStatus: 'pending',
    paymentMethod: 'upi-qr',
    generatedDate: '2026-06-17',
  },
  {
    invoiceId: 'INV-1781776207293',
    orderId: 'ORD-1781776207293',
    customerName: 'Test Customer',
    amount: 43880,
    paymentStatus: 'paid',
    paymentMethod: 'bulk_sheet|cod',
    generatedDate: '2026-06-16',
  },
]

export function invoiceTemplateMatrix(): string[][] {
  return [
    [...INVOICE_TEMPLATE_HEADERS],
    ...INVOICE_TEMPLATE_SAMPLE.map((row) => [
      row.invoiceId,
      row.orderId,
      row.customerName,
      String(row.amount),
      row.paymentStatus,
      row.paymentMethod,
      row.generatedDate,
    ]),
  ]
}

export function invoiceTemplateCsv(): string {
  return invoiceTemplateMatrix()
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

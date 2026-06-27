import { query } from './db'
import type { SalesChartFilter } from './salesChartFilter'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type SalesChartMonth = {
  key: string
  month: string
  credited: number
  refunds: number
  soldProducts: number
  returnedProducts: number
  warrantyClaimed: number
}

type OrderRow = {
  items: string
  total: number
  status: string
  payment_status: string
  created_at: string
  returned_qty: number | null
  warranty_claim_qty: number | null
}

type BucketDef = { key: string; label: string; granularity: 'day' | 'month' }

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
}

function dayLabel(ymd: string): string {
  const [, month, day] = ymd.split('-')
  return `${parseInt(day, 10)} ${MONTH_NAMES[parseInt(month, 10) - 1]}`
}

function itemQuantity(itemsJson: string): number {
  try {
    const items = JSON.parse(itemsJson) as { quantity?: number }[]
    if (!Array.isArray(items)) return 0
    return items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  } catch {
    return 0
  }
}

function emptyBucket(def: BucketDef): SalesChartMonth {
  return {
    key: def.key,
    month: def.label,
    credited: 0,
    refunds: 0,
    soldProducts: 0,
    returnedProducts: 0,
    warrantyClaimed: 0,
  }
}

function lastMonths(count: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function addMonths(ym: string, delta: number): string {
  const [year, month] = ym.split('-').map(Number)
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeysBetween(startYm: string, endYm: string): string[] {
  const keys: string[] = []
  let current = startYm
  while (current <= endYm) {
    keys.push(current)
    if (current === endYm) break
    current = addMonths(current, 1)
  }
  return keys
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T12:00:00`).getTime()
  const endMs = new Date(`${end}T12:00:00`).getTime()
  return Math.floor((endMs - startMs) / 86400000) + 1
}

function addDays(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function dayKeysBetween(start: string, end: string): string[] {
  const keys: string[] = []
  let current = start
  while (current <= end) {
    keys.push(current)
    if (current === end) break
    current = addDays(current, 1)
  }
  return keys
}

function fyRangeToDates(startFy: number, endFy: number): { startDate: string; endDate: string } {
  return {
    startDate: `${startFy}-04-01`,
    endDate: `${endFy + 1}-03-31`,
  }
}

function resolveBuckets(filter: SalesChartFilter): BucketDef[] {
  if (filter.type === 'month') {
    const keys = monthKeysBetween(filter.start, filter.end)
    return keys.map((key) => ({ key, label: monthLabel(key), granularity: 'month' }))
  }

  if (filter.type === 'fy') {
    const startFy = Number(filter.start)
    const endFy = Number(filter.end)
    const { startDate, endDate } = fyRangeToDates(startFy, endFy)
    const startYm = startDate.slice(0, 7)
    const endYm = endDate.slice(0, 7)
    const keys = monthKeysBetween(startYm, endYm)
    return keys.map((key) => ({ key, label: monthLabel(key), granularity: 'month' }))
  }

  const spanDays = daysBetween(filter.start, filter.end)
  if (spanDays <= 62) {
    const keys = dayKeysBetween(filter.start, filter.end)
    return keys.map((key) => ({ key, label: dayLabel(key), granularity: 'day' }))
  }

  const startYm = filter.start.slice(0, 7)
  const endYm = filter.end.slice(0, 7)
  const keys = monthKeysBetween(startYm, endYm)
  return keys.map((key) => ({ key, label: monthLabel(key), granularity: 'month' }))
}

function bucketKeyForRow(createdAt: string, granularity: 'day' | 'month'): string {
  return granularity === 'day' ? createdAt.slice(0, 10) : createdAt.slice(0, 7)
}

async function aggregateOrders(
  buckets: BucketDef[],
  fromDate: string
): Promise<Map<string, SalesChartMonth>> {
  const rows = await query<OrderRow>(
    `SELECT items, total, status, payment_status, created_at, returned_qty, warranty_claim_qty
     FROM orders
     WHERE created_at >= ?`,
    [fromDate]
  )

  const granularity = buckets[0]?.granularity ?? 'month'
  const map = new Map(buckets.map((bucket) => [bucket.key, emptyBucket(bucket)]))
  const bucketKeys = new Set(buckets.map((b) => b.key))

  for (const row of rows) {
    const key = bucketKeyForRow(row.created_at, granularity)
    if (!bucketKeys.has(key)) continue
    const bucket = map.get(key)
    if (!bucket) continue

    const qty = itemQuantity(row.items)
    const returnedQty = row.returned_qty && row.returned_qty > 0 ? row.returned_qty : qty

    if (row.payment_status === 'paid' && row.status !== 'cancelled') {
      bucket.credited += row.total
      bucket.soldProducts += qty
    }

    if (row.payment_status === 'refunded') {
      bucket.refunds += row.total
    }

    if (row.status === 'cancelled' && (row.payment_status === 'refunded' || row.payment_status === 'failed')) {
      bucket.returnedProducts += returnedQty
    }

    bucket.warrantyClaimed += row.warranty_claim_qty ?? 0
  }

  return map
}

async function aggregateWarrantyClaims(
  map: Map<string, SalesChartMonth>,
  buckets: BucketDef[],
  fromDate: string
) {
  const granularity = buckets[0]?.granularity ?? 'month'
  const bucketKeys = new Set(buckets.map((b) => b.key))

  const warrantyRows = await query<{ created_at: string }>(
    `SELECT created_at
     FROM contact_messages
     WHERE LOWER(subject) LIKE '%warranty%'
       AND created_at >= ?`,
    [fromDate]
  )

  for (const row of warrantyRows) {
    const key = bucketKeyForRow(row.created_at, granularity)
    if (!bucketKeys.has(key)) continue
    const bucket = map.get(key)
    if (bucket) bucket.warrantyClaimed += 1
  }
}

export async function buildSalesChartData(
  filter?: SalesChartFilter | null,
  defaultMonthCount = 6
): Promise<SalesChartMonth[]> {
  const effectiveBuckets = filter
    ? resolveBuckets(filter)
    : lastMonths(defaultMonthCount).map((key) => ({
        key,
        label: monthLabel(key),
        granularity: 'month' as const,
      }))

  const fromDate =
    effectiveBuckets[0]?.granularity === 'day'
      ? `${effectiveBuckets[0].key}T00:00:00`
      : `${effectiveBuckets[0]?.key ?? '2000-01'}-01`

  const map = await aggregateOrders(effectiveBuckets, fromDate)
  await aggregateWarrantyClaims(map, effectiveBuckets, fromDate)

  return effectiveBuckets.map((bucket) => map.get(bucket.key) ?? emptyBucket(bucket))
}

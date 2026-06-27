import { getAllProducts, query } from './db'
import type {
  AdminReportPayload,
  DateRangePreset,
  SalesPeriod,
} from './adminReportTypes'

type OrderRow = {
  id: string
  user_id: string
  items: string
  total: number
  status: string
  payment_status: string
  payment_method: string | null
  delivery_method: string | null
  created_at: string
  returned_qty: number | null
}

type CartItem = {
  productId?: string
  quantity?: number
  product?: {
    name?: string
    modelId?: string
    price?: number
    originalPrice?: number
    category?: string
  }
}

const GST_RATE = 0.18
const ESTIMATED_COST_RATIO = 0.65
const SHIPPING_PER_ORDER = 120

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date; label: string } {
  const now = new Date()
  const today = startOfDay(now)

  switch (preset) {
    case 'today':
      return { start: today, end: endOfDay(now), label: 'Today' }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { start: y, end: endOfDay(y), label: 'Yesterday' }
    }
    case 'last7': {
      const s = new Date(today)
      s.setDate(s.getDate() - 6)
      return { start: s, end: endOfDay(now), label: 'Last 7 Days' }
    }
    case 'last30': {
      const s = new Date(today)
      s.setDate(s.getDate() - 29)
      return { start: s, end: endOfDay(now), label: 'Last 30 Days' }
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: s, end: endOfDay(now), label: 'This Month' }
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: s, end: endOfDay(e), label: 'Last Month' }
    }
    case 'thisYear': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s, end: endOfDay(now), label: 'This Year' }
    }
    case 'custom': {
      const s = customStart ? startOfDay(new Date(customStart)) : today
      const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now)
      return { start: s, end: e, label: `${formatDateKey(s)} → ${formatDateKey(e)}` }
    }
    default:
      return { start: today, end: endOfDay(now), label: 'Today' }
  }
}

function previousRange(start: Date, end: Date): { start: Date; end: Date } {
  const ms = end.getTime() - start.getTime() + 1
  const prevEnd = new Date(start.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - ms + 1)
  return { start: prevStart, end: prevEnd }
}

function parseItems(raw: string): CartItem[] {
  try {
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function orderInRange(createdAt: string, start: Date, end: Date): boolean {
  const t = new Date(createdAt).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

function periodKey(date: Date, period: SalesPeriod): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (period === 'daily') return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (period === 'weekly') {
    const jan1 = new Date(y, 0, 1)
    const week = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
    return `${y}-W${String(week).padStart(2, '0')}`
  }
  if (period === 'monthly') return `${y}-${String(m).padStart(2, '0')}`
  if (period === 'quarterly') return `${y}-Q${Math.ceil(m / 3)}`
  return String(y)
}

function formatPeriodLabel(key: string, period: SalesPeriod): string {
  if (period === 'daily') {
    const [y, m, d] = key.split('-')
    return `${d}/${m}/${y}`
  }
  return key
}

function normalizePayment(method: string | null): string {
  const m = (method || 'card').toLowerCase()
  if (m.includes('upi')) return 'UPI'
  if (m.includes('cod') || m.includes('cash')) return 'Cash on Delivery'
  if (m.includes('credit')) return 'Credit Card'
  if (m.includes('debit')) return 'Debit Card'
  if (m.includes('net') || m.includes('bank')) return 'Net Banking'
  if (m.includes('wallet')) return 'Wallet'
  if (m === 'card') return 'Credit Card'
  return method || 'Other'
}

function displayStatus(status: string, returnedQty: number): string {
  if (status === 'cancelled' && returnedQty > 0) return 'Returned'
  if (status === 'pending') return 'Pending'
  if (status === 'confirmed') return 'Processing'
  if (status === 'shipped') return 'Shipped'
  if (status === 'delivered') return 'Delivered'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

export async function buildAdminReport(
  preset: DateRangePreset,
  period: SalesPeriod,
  customStart?: string,
  customEnd?: string,
  orderStatusFilter?: string
): Promise<AdminReportPayload> {
  const range = resolveDateRange(preset, customStart, customEnd)
  const prev = previousRange(range.start, range.end)

  const allOrders = await query<OrderRow>(
    `SELECT id, user_id, items, total, status, payment_status, payment_method, delivery_method, created_at, returned_qty
     FROM orders`
  )

  const users = await query<{ id: string; name: string; email: string }>(
    'SELECT id, name, email FROM users WHERE role = ?',
    ['customer']
  )
  const userMap = new Map(users.map((u) => [u.id, u]))

  const products = await getAllProducts()
  const productMap = new Map(products.map((p) => [p.id, p]))

  const inRange = allOrders.filter((o) => orderInRange(o.created_at, range.start, range.end))
  const prevRange = allOrders.filter((o) => orderInRange(o.created_at, prev.start, prev.end))

  const filtered = orderStatusFilter && orderStatusFilter !== 'all'
    ? inRange.filter((o) => {
        const label = displayStatus(o.status, o.returned_qty ?? 0).toLowerCase()
        return label === orderStatusFilter.toLowerCase()
      })
    : inRange

  const paidOrders = filtered.filter((o) => o.status !== 'cancelled' && o.payment_status === 'paid')
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0)
  const totalSales = filtered.reduce((s, o) => s + (o.payment_status === 'paid' ? o.total : 0), 0)
  const customerIds = new Set(filtered.map((o) => o.user_id))
  let totalUnits = 0
  let totalDiscount = 0

  const productAgg = new Map<
    string,
    { name: string; sku: string; qty: number; revenue: number; orders: number; category: string }
  >()
  const categoryAgg = new Map<string, { sales: number; orders: number }>()
  const customerAgg = new Map<string, { orders: number; total: number; lastDate: string }>()
  const paymentAgg = new Map<string, { sales: number; orders: number }>()
  const statusAgg = new Map<string, { count: number; revenue: number }>()
  const periodAgg = new Map<string, { sales: number; orders: number; units: number }>()

  for (const order of filtered) {
    const items = parseItems(order.items)
    const qty = items.reduce((s, i) => s + (i.quantity ?? 0), 0)
    totalUnits += qty

    const statusLabel = displayStatus(order.status, order.returned_qty ?? 0)
    const statusRow = statusAgg.get(statusLabel) ?? { count: 0, revenue: 0 }
    statusRow.count += 1
    if (order.payment_status === 'paid') statusRow.revenue += order.total
    statusAgg.set(statusLabel, statusRow)

    const pKey = periodKey(new Date(order.created_at), period)
    const pRow = periodAgg.get(pKey) ?? { sales: 0, orders: 0, units: 0 }
    pRow.orders += 1
    if (order.payment_status === 'paid') pRow.sales += order.total
    pRow.units += qty
    periodAgg.set(pKey, pRow)

    const payLabel = normalizePayment(order.payment_method)
    const payRow = paymentAgg.get(payLabel) ?? { sales: 0, orders: 0 }
    payRow.orders += 1
    if (order.payment_status === 'paid') payRow.sales += order.total
    paymentAgg.set(payLabel, payRow)

    const user = userMap.get(order.user_id)
    const cName = user?.name || order.user_id
    const cRow = customerAgg.get(order.user_id) ?? { orders: 0, total: 0, lastDate: order.created_at }
    cRow.orders += 1
    if (order.payment_status === 'paid') cRow.total += order.total
    if (order.created_at > cRow.lastDate) cRow.lastDate = order.created_at
    customerAgg.set(order.user_id, cRow)

    for (const item of items) {
      const pid = item.productId || ''
      const prod = pid ? productMap.get(pid) : item.product
      const name = prod?.name || item.product?.name || 'Unknown'
      const sku = prod?.modelId || item.product?.modelId || pid || '—'
      const category = prod?.category || item.product?.category || 'General'
      const lineRev = (prod?.price ?? item.product?.price ?? 0) * (item.quantity ?? 0)
      const unitPrice = prod?.price ?? item.product?.price ?? 0
      const unitOriginal = prod?.originalPrice ?? item.product?.originalPrice
      if (unitOriginal != null && unitOriginal > unitPrice) {
        totalDiscount += (unitOriginal - unitPrice) * (item.quantity ?? 0)
      }

      const pa = productAgg.get(pid || name) ?? {
        name,
        sku,
        qty: 0,
        revenue: 0,
        orders: 0,
        category,
      }
      pa.qty += item.quantity ?? 0
      if (order.payment_status === 'paid') pa.revenue += lineRev
      pa.orders += 1
      productAgg.set(pid || name, pa)

      const ca = categoryAgg.get(category) ?? { sales: 0, orders: 0 }
      if (order.payment_status === 'paid') ca.sales += lineRev
      ca.orders += 1
      categoryAgg.set(category, ca)
    }
  }

  const cancelledOrders = filtered.filter((o) => o.status === 'cancelled').length
  const returnedOrders = filtered.filter((o) => (o.returned_qty ?? 0) > 0).length
  const pendingOrders = filtered.filter((o) => o.status === 'pending').length

  const prevRevenue = prevRange
    .filter((o) => o.status !== 'cancelled' && o.payment_status === 'paid')
    .reduce((s, o) => s + o.total, 0)

  const taxableAmount = totalRevenue / (1 + GST_RATE)
  const gstCollected = totalRevenue - taxableAmount
  const productCost = totalRevenue * ESTIMATED_COST_RATIO
  const shippingCost = paidOrders.length * SHIPPING_PER_ORDER
  const grossProfit = totalRevenue - productCost
  const netProfit = grossProfit - shippingCost - totalDiscount
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const productSales = [...productAgg.values()]
    .map((p) => ({
      productName: p.name,
      sku: p.sku,
      quantitySold: p.qty,
      revenue: p.revenue,
      stockRemaining:
        products.find((pr) => pr.modelId === p.sku)?.stock ??
        products.find((pr) => pr.name === p.name)?.stock ??
        0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const topProducts = productSales.slice(0, 10).map((p, i) => ({
    rank: i + 1,
    productName: p.productName,
    sku: p.sku,
    quantitySold: p.quantitySold,
    revenue: p.revenue,
    orders: productAgg.get(
      [...productAgg.entries()].find(([, v]) => v.sku === p.sku)?.[0] || p.productName
    )?.orders ?? 0,
  }))

  const lowProducts = [
    ...productSales.filter((p) => p.quantitySold <= 2),
    ...products
      .filter((p) => !productSales.some((ps) => ps.sku === p.modelId))
      .map((p) => ({
        productName: p.name,
        sku: p.modelId,
        quantitySold: 0,
        revenue: 0,
        stock: p.stock,
      })),
  ]
    .slice(0, 15)
    .map((p) => ({
      productName: p.productName,
      sku: p.sku,
      quantitySold: p.quantitySold,
      revenue: p.revenue,
      stock: 'stock' in p ? p.stock : p.stockRemaining,
    }))

  const salesByPeriod = [...periodAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      period: formatPeriodLabel(key, period),
      sales: val.sales,
      orders: val.orders,
      units: val.units,
    }))

  const salesOverTime = salesByPeriod.map((r) => ({ label: r.period, revenue: r.sales }))

  return {
    generatedAt: new Date().toISOString(),
    dateRange: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: range.label,
    },
    summary: {
      totalSales,
      totalOrders: filtered.length,
      totalRevenue,
      totalCustomers: customerIds.size,
      averageOrderValue: paidOrders.length ? totalRevenue / paidOrders.length : 0,
      totalProductsSold: totalUnits,
      cancelledOrders,
      returnedOrders,
      pendingOrders,
    },
    salesByPeriod,
    orderStatusBreakdown: [...statusAgg.entries()].map(([status, val]) => ({
      status,
      count: val.count,
      revenue: val.revenue,
    })),
    productSales,
    categorySales: [...categoryAgg.entries()]
      .map(([category, val]) => ({ category, sales: val.sales, orders: val.orders }))
      .sort((a, b) => b.sales - a.sales),
    customerSales: [...customerAgg.entries()]
      .map(([userId, val]) => ({
        customerName: userMap.get(userId)?.name?.replace(/\s+customer$/i, '') || userId,
        orders: val.orders,
        totalPurchase: val.total,
        lastPurchaseDate: val.lastDate,
      }))
      .sort((a, b) => b.totalPurchase - a.totalPurchase),
    paymentMethods: [...paymentAgg.entries()]
      .map(([method, val]) => ({ method, sales: val.sales, orders: val.orders }))
      .sort((a, b) => b.sales - a.sales),
    coupons: [],
    tax: {
      gstCollected,
      cgst: gstCollected / 2,
      sgst: gstCollected / 2,
      igst: 0,
      taxableAmount,
    },
    shipping: {
      shippingCharges: paidOrders.length * SHIPPING_PER_ORDER,
      deliveredOrders: filtered.filter((o) => o.status === 'delivered').length,
      returnedShipments: returnedOrders,
      provider: 'HDS Logistics',
    },
    topProducts,
    lowProducts,
    profit: {
      grossProfit,
      netProfit,
      profitMargin,
      revenue: totalRevenue,
      productCost,
      shippingCost,
      discounts: totalDiscount,
      taxes: gstCollected,
    },
    comparison: {
      label: `${range.label} vs previous period`,
      currentRevenue: totalRevenue,
      previousRevenue: prevRevenue,
      currentOrders: filtered.length,
      previousOrders: prevRange.length,
      revenueChangePct:
        prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : totalRevenue > 0 ? 100 : 0,
      ordersChangePct:
        prevRange.length > 0
          ? ((filtered.length - prevRange.length) / prevRange.length) * 100
          : filtered.length > 0
            ? 100
            : 0,
    },
    orderDetails: filtered.slice(0, 100).map((o) => {
      const items = parseItems(o.items)
      const user = userMap.get(o.user_id)
      return {
        orderId: o.id,
        customer: user?.name?.replace(/\s+customer$/i, '') || o.user_id,
        products: items.map((i) => i.product?.name || i.productId || 'Item').join(', '),
        quantity: items.reduce((s, i) => s + (i.quantity ?? 0), 0),
        totalAmount: o.total,
        paymentStatus: o.payment_status,
        orderStatus: displayStatus(o.status, o.returned_qty ?? 0),
        orderDate: o.created_at,
        paymentMethod: normalizePayment(o.payment_method),
      }
    }),
    chartSeries: {
      salesOverTime,
      categoryPie: [...categoryAgg.entries()].map(([label, val]) => ({
        label,
        value: val.sales,
      })),
      paymentDonut: [...paymentAgg.entries()].map(([label, val]) => ({
        label,
        value: val.sales,
      })),
      monthlyBars: salesOverTime,
    },
  }
}

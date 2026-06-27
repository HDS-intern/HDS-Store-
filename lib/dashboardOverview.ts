import { getAllProducts, query } from './db'

type CartItem = {
  productId?: string
  quantity?: number
  product?: { name?: string; price?: number; category?: string }
}

export type DashboardTopProduct = {
  id: string
  name: string
  image: string
  sold: number
  revenue: number
}

export type DashboardCategorySale = {
  category: string
  sales: number
  orders: number
  productCount: number
}

export const DASHBOARD_PAYMENT_CHANNELS = ['UPI', 'NEFT', 'Card Transfer', 'COD'] as const

export type DashboardPaymentChannel = {
  label: (typeof DASHBOARD_PAYMENT_CHANNELS)[number]
  value: number
  orders: number
}

export type DashboardRecentOrder = {
  id: string
  customer: string
  amount: number
  status: string
  date: string
}

export type DashboardCustomerTrendDay = {
  day: string
  newCustomers: number
  returning: number
}

export type DashboardOverviewExtras = {
  totalCustomers: number
  averageOrderValue: number
  conversionRate: number
  netProfit: number
  revenueChangePct: number
  ordersChangePct: number
  customersChangePct: number
  sparklineRevenue: number[]
  topProducts: DashboardTopProduct[]
  categorySales: DashboardCategorySale[]
  paymentChannels: DashboardPaymentChannel[]
  recentOrders: DashboardRecentOrder[]
  customerTrend: DashboardCustomerTrendDay[]
}

const NET_PROFIT_MARGIN = 0.35

function parseItems(raw: string): CartItem[] {
  try {
    const parsed = JSON.parse(raw) as CartItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizePayment(method: string | null): (typeof DASHBOARD_PAYMENT_CHANNELS)[number] {
  const m = (method || '').toLowerCase()
  if (m.includes('upi')) return 'UPI'
  if (m.includes('neft') || m.includes('net') || m.includes('bank') || m.includes('transfer')) return 'NEFT'
  if (m.includes('cod') || m.includes('cash')) return 'COD'
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return 'Card Transfer'
  return 'COD'
}

function displayStatus(status: string): string {
  if (status === 'pending') return 'Processing'
  if (status === 'confirmed') return 'Processing'
  if (status === 'shipped') return 'Shipped'
  if (status === 'delivered') return 'Delivered'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function buildDashboardOverviewExtras(): Promise<DashboardOverviewExtras> {
  const orders = await query<{
    id: string
    user_id: string
    items: string
    total: number
    status: string
    payment_status: string
    payment_method: string | null
    created_at: string
  }>(
    `SELECT id, user_id, items, total, status, payment_status, payment_method, created_at
     FROM orders WHERE status != 'cancelled' ORDER BY created_at DESC`
  )

  const paidOrders = orders.filter((o) => o.payment_status === 'paid')
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0)
  const customerIds = new Set(orders.map((o) => o.user_id))
  const totalCustomers = customerIds.size
  const averageOrderValue = paidOrders.length ? totalRevenue / paidOrders.length : 0
  const conversionRate = orders.length ? (paidOrders.length / orders.length) * 100 : 0
  const netProfit = totalRevenue * NET_PROFIT_MARGIN

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const thisMonthPaid = paidOrders.filter((o) => new Date(o.created_at) >= thisMonthStart)
  const lastMonthPaid = paidOrders.filter((o) => {
    const d = new Date(o.created_at)
    return d >= lastMonthStart && d <= lastMonthEnd
  })

  const thisMonthRevenue = thisMonthPaid.reduce((s, o) => s + o.total, 0)
  const lastMonthRevenue = lastMonthPaid.reduce((s, o) => s + o.total, 0)
  const thisMonthOrders = orders.filter((o) => new Date(o.created_at) >= thisMonthStart).length
  const lastMonthOrders = orders.filter((o) => {
    const d = new Date(o.created_at)
    return d >= lastMonthStart && d <= lastMonthEnd
  }).length

  const thisMonthCustomers = new Set(
    orders.filter((o) => new Date(o.created_at) >= thisMonthStart).map((o) => o.user_id)
  ).size
  const lastMonthCustomers = new Set(
    orders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= lastMonthStart && d <= lastMonthEnd
    }).map((o) => o.user_id)
  ).size

  const pct = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0

  const sparklineKeys: string[] = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    sparklineKeys.push(monthKey(d))
  }
  const sparklineRevenue = sparklineKeys.map((key) =>
    paidOrders
      .filter((o) => monthKey(new Date(o.created_at)) === key)
      .reduce((s, o) => s + o.total, 0)
  )

  const productAgg = new Map<string, { name: string; sold: number; revenue: number; category: string }>()
  const categoryAgg = new Map<string, { sales: number; orders: number; products: Set<string> }>()
  const paymentAgg = new Map<string, { value: number; orders: number }>()
  const products = await getAllProducts()
  const productMap = new Map(products.map((p) => [p.id, p]))

  for (const label of DASHBOARD_PAYMENT_CHANNELS) {
    paymentAgg.set(label, { value: 0, orders: 0 })
  }

  for (const p of products) {
    if (!categoryAgg.has(p.category)) {
      categoryAgg.set(p.category, { sales: 0, orders: 0, products: new Set() })
    }
    categoryAgg.get(p.category)!.products.add(p.id)
  }

  for (const order of paidOrders) {
    const pay = normalizePayment(order.payment_method)
    const payRow = paymentAgg.get(pay)!
    payRow.value += order.total
    payRow.orders += 1

    const orderCategories = new Set<string>()
    for (const item of parseItems(order.items)) {
      const pid = item.productId || ''
      const prod = pid ? productMap.get(pid) : undefined
      const name = prod?.name || item.product?.name || 'Unknown'
      const qty = item.quantity ?? 0
      const lineRev = (prod?.price ?? item.product?.price ?? 0) * qty
      const category = prod?.category || item.product?.category || 'General'

      const row = productAgg.get(pid || name) ?? { name, sold: 0, revenue: 0, category }
      row.sold += qty
      row.revenue += lineRev
      productAgg.set(pid || name, row)

      const ca = categoryAgg.get(category) ?? { sales: 0, orders: 0, products: new Set<string>() }
      ca.sales += lineRev
      if (pid) ca.products.add(pid)
      categoryAgg.set(category, ca)
      orderCategories.add(category)
    }
    for (const cat of orderCategories) {
      categoryAgg.get(cat)!.orders += 1
    }
  }

  const topProducts = [...productAgg.entries()]
    .map(([id, val]) => ({
      id,
      name: val.name,
      image: productMap.get(id)?.image || '/images/drone-sentinel-pro.png',
      sold: val.sold,
      revenue: val.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const categorySales = [...categoryAgg.entries()]
    .map(([category, val]) => ({
      category,
      sales: val.sales,
      orders: val.orders,
      productCount: val.products.size,
    }))
    .sort((a, b) => b.sales - a.sales)

  const paymentChannels = DASHBOARD_PAYMENT_CHANNELS.map((label) => {
    const row = paymentAgg.get(label)!
    return { label, value: row.value, orders: row.orders }
  })

  const userRows = await query<{ id: string; name: string }>('SELECT id, name FROM users')
  const userMap = new Map(userRows.map((u) => [u.id, u.name]))

  const recentOrders = orders.slice(0, 5).map((o) => ({
    id: o.id,
    customer: (userMap.get(o.user_id) || 'Customer').replace(/\s+customer$/i, ''),
    amount: o.total,
    status: displayStatus(o.status),
    date: o.created_at,
  }))

  const firstOrderByUser = new Map<string, string>()
  for (const order of [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )) {
    if (!firstOrderByUser.has(order.user_id)) {
      firstOrderByUser.set(order.user_id, order.created_at)
    }
  }

  const customerTrend: DashboardCustomerTrendDay[] = []
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter((o) => o.created_at.slice(0, 10) === key)
    let newCustomers = 0
    let returning = 0
    for (const o of dayOrders) {
      const first = firstOrderByUser.get(o.user_id)
      if (first?.slice(0, 10) === key) newCustomers += 1
      else returning += 1
    }
    customerTrend.push({
      day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      newCustomers,
      returning,
    })
  }

  return {
    totalCustomers,
    averageOrderValue,
    conversionRate,
    netProfit,
    revenueChangePct: pct(thisMonthRevenue, lastMonthRevenue),
    ordersChangePct: pct(thisMonthOrders, lastMonthOrders),
    customersChangePct: pct(thisMonthCustomers, lastMonthCustomers),
    sparklineRevenue,
    topProducts,
    categorySales,
    paymentChannels,
    recentOrders,
    customerTrend,
  }
}

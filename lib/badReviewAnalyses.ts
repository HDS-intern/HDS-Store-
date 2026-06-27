import { getAllProducts, query } from './db'

export const BAD_REVIEW_MAX_RATING = 2
export const GOOD_REVIEW_MIN_RATING = 4

export interface BadReviewChartMonth {
  key: string
  month: string
  badReviews: number
  goodReviews: number
  totalReviews: number
}

export interface ProductReviewScore {
  productId: string
  productName: string
  averageScore: number
  goodReviews: number
  badReviews: number
  totalReviews: number
}

export interface BadReviewProductSummary {
  productId: string
  productName: string
  badReviewCount: number
  totalReviewCount: number
}

export interface BadReviewEntry {
  id: string
  userId: string | null
  customerName: string
  customerEmail: string | null
  productId: string
  productName: string
  rating: number
  title: string
  comment: string
  createdAt: string
  orderId?: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonthKey(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate.slice(0, 7)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
}

function lastNMonthKeys(count: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

type RawReview = {
  id: string
  productId: string
  productName: string
  userId: string | null
  customerName: string
  customerEmail: string | null
  rating: number
  title: string
  comment: string
  createdAt: string
  orderId?: string
}

async function collectAllReviews(): Promise<RawReview[]> {
  const dbRows = await query<{
    id: string
    product_id: string
    user_id: string
    order_id: string | null
    rating: number
    title: string
    comment: string
    created_at: string
    customer_name: string
    customer_email: string
    product_name: string
  }>(
    `SELECT r.id, r.product_id, r.user_id, r.order_id, r.rating, r.title, r.comment, r.created_at,
            u.name as customer_name, u.email as customer_email,
            (p.data::json->>'name') as product_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC`
  )

  const fromDb: RawReview[] = dbRows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    createdAt: row.created_at,
    orderId: row.order_id ?? undefined,
  }))

  const dbIds = new Set(fromDb.map((review) => review.id))
  const legacy: RawReview[] = []

  for (const product of await getAllProducts()) {
    for (const review of product.reviewList ?? []) {
      if (dbIds.has(review.id)) continue
      legacy.push({
        id: review.id,
        productId: product.id,
        productName: product.name,
        userId: review.userId ?? null,
        customerName: review.author,
        customerEmail: null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.date,
        orderId: review.orderId,
      })
    }
  }

  return [...fromDb, ...legacy]
}

export function isBadReview(rating: number): boolean {
  return rating <= BAD_REVIEW_MAX_RATING
}

export function isGoodReview(rating: number): boolean {
  return rating >= GOOD_REVIEW_MIN_RATING
}

export async function getBadReviewProducts(): Promise<BadReviewProductSummary[]> {
  const byProduct = new Map<string, BadReviewProductSummary>()

  for (const review of await collectAllReviews()) {
    const existing = byProduct.get(review.productId) ?? {
      productId: review.productId,
      productName: review.productName,
      badReviewCount: 0,
      totalReviewCount: 0,
    }
    existing.totalReviewCount += 1
    if (isBadReview(review.rating)) existing.badReviewCount += 1
    byProduct.set(review.productId, existing)
  }

  return [...byProduct.values()]
    .filter((product) => product.badReviewCount > 0)
    .sort(
      (left, right) =>
        right.badReviewCount - left.badReviewCount ||
        left.productName.localeCompare(right.productName)
    )
}

export async function getBadReviewChart(productId?: string): Promise<BadReviewChartMonth[]> {
  const reviews = (await collectAllReviews()).filter(
    (review) => !productId || review.productId === productId
  )
  const monthKeys = lastNMonthKeys(6)
  const counts = new Map<string, { bad: number; good: number; total: number }>()

  for (const key of monthKeys) {
    counts.set(key, { bad: 0, good: 0, total: 0 })
  }

  for (const review of reviews) {
    const key = formatMonthKey(review.createdAt)
    const bucket = counts.get(key)
    if (!bucket) continue
    bucket.total += 1
    if (isBadReview(review.rating)) bucket.bad += 1
    if (isGoodReview(review.rating)) bucket.good += 1
  }

  return monthKeys.map((key) => ({
    key,
    month: formatMonthLabel(key),
    badReviews: counts.get(key)!.bad,
    goodReviews: counts.get(key)!.good,
    totalReviews: counts.get(key)!.total,
  }))
}

export async function getProductReviewScores(): Promise<ProductReviewScore[]> {
  const byProduct = new Map<
    string,
    { productName: string; ratings: number[]; good: number; bad: number }
  >()

  for (const review of await collectAllReviews()) {
    const existing = byProduct.get(review.productId) ?? {
      productName: review.productName,
      ratings: [],
      good: 0,
      bad: 0,
    }
    existing.ratings.push(review.rating)
    if (isGoodReview(review.rating)) existing.good += 1
    if (isBadReview(review.rating)) existing.bad += 1
    byProduct.set(review.productId, existing)
  }

  return [...byProduct.entries()]
    .map(([productId, val]) => ({
      productId,
      productName: val.productName,
      averageScore:
        val.ratings.length > 0
          ? Math.round((val.ratings.reduce((s, r) => s + r, 0) / val.ratings.length) * 10) / 10
          : 0,
      goodReviews: val.good,
      badReviews: val.bad,
      totalReviews: val.ratings.length,
    }))
    .filter((p) => p.totalReviews > 0)
    .sort((a, b) => b.totalReviews - a.totalReviews)
    .slice(0, 8)
}

export async function getGoodReviewEntries(productId?: string): Promise<BadReviewEntry[]> {
  return (await collectAllReviews())
    .filter((review) => isGoodReview(review.rating))
    .filter((review) => !productId || review.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((review) => ({
      id: review.id,
      userId: review.userId,
      customerName: review.customerName,
      customerEmail: review.customerEmail,
      productId: review.productId,
      productName: review.productName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      orderId: review.orderId,
    }))
}

export async function getBadReviewEntries(productId?: string): Promise<BadReviewEntry[]> {
  return (await collectAllReviews())
    .filter((review) => isBadReview(review.rating))
    .filter((review) => !productId || review.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((review) => ({
      id: review.id,
      userId: review.userId,
      customerName: review.customerName,
      customerEmail: review.customerEmail,
      productId: review.productId,
      productName: review.productName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      orderId: review.orderId,
    }))
}

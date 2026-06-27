import { randomBytes } from 'crypto'
import { query, queryOne, execute, getProductById } from './db'
import type { ProductReview } from './types'

type DbReviewRow = {
  id: string
  product_id: string
  user_id: string
  order_id: string | null
  rating: number
  title: string
  comment: string
  verified: number
  created_at: string
  author_name?: string
}

function rowToReview(row: DbReviewRow, authorName: string): ProductReview {
  return {
    id: row.id,
    author: authorName,
    userId: row.user_id,
    orderId: row.order_id ?? undefined,
    rating: row.rating,
    date: row.created_at,
    title: row.title,
    comment: row.comment,
    verified: Boolean(row.verified),
  }
}

export async function hasUserPurchasedProduct(
  userId: string,
  productId: string
): Promise<{ purchased: boolean; orderId?: string }> {
  const orders = await query<{ id: string; items: string }>(
    'SELECT id, items FROM orders WHERE user_id = ?',
    [userId]
  )

  for (const order of orders) {
    const items = JSON.parse(order.items) as { productId: string }[]
    if (items.some((item) => item.productId === productId)) {
      return { purchased: true, orderId: order.id }
    }
  }
  return { purchased: false }
}

export async function getReviewsForProduct(productId: string): Promise<ProductReview[]> {
  const rows = await query<DbReviewRow>(
    `SELECT r.*, u.name as author_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC`,
    [productId]
  )

  return rows.map((row) => rowToReview(row, row.author_name || 'Customer'))
}

export async function getUserReviewForProduct(
  userId: string,
  productId: string
): Promise<ProductReview | null> {
  const row = await queryOne<DbReviewRow>(
    `SELECT r.*, u.name as author_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? AND r.user_id = ?`,
    [productId, userId]
  )

  return row ? rowToReview(row, row.author_name || 'Customer') : null
}

export async function getMergedReviewsForProduct(productId: string): Promise<ProductReview[]> {
  const product = await getProductById(productId)
  const dbReviews = await getReviewsForProduct(productId)
  const dbIds = new Set(dbReviews.map((r) => r.id))
  const legacyReviews = (product?.reviewList ?? []).filter((r) => !dbIds.has(r.id))
  return [...dbReviews, ...legacyReviews]
}

export async function submitReview(params: {
  productId: string
  userId: string
  orderId?: string
  rating: number
  title: string
  comment: string
}): Promise<ProductReview> {
  const existing = await getUserReviewForProduct(params.userId, params.productId)
  if (existing) {
    throw new Error('You have already reviewed this product')
  }

  const { purchased, orderId } = await hasUserPurchasedProduct(params.userId, params.productId)
  if (!purchased) {
    throw new Error('Only customers who purchased this product can leave a review')
  }

  const user = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [
    params.userId,
  ])
  if (!user) throw new Error('User not found')

  const id = `rev-${randomBytes(8).toString('hex')}`
  const now = new Date().toISOString()

  await execute(
    `INSERT INTO reviews (id, product_id, user_id, order_id, rating, title, comment, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.productId,
      params.userId,
      params.orderId || orderId || null,
      params.rating,
      params.title.trim(),
      params.comment.trim(),
      1,
      now,
    ]
  )

  await updateProductReviewAggregates(params.productId)

  return {
    id,
    author: user.name,
    userId: params.userId,
    orderId: params.orderId || orderId,
    rating: params.rating,
    date: now,
    title: params.title.trim(),
    comment: params.comment.trim(),
    verified: true,
  }
}

export async function updateProductReviewAggregates(productId: string): Promise<void> {
  const product = await getProductById(productId)
  if (!product) return

  const allReviews = await getMergedReviewsForProduct(productId)
  const avgRating =
    allReviews.length > 0
      ? Math.round(
          (allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length) * 10
        ) / 10
      : 0

  const updated = {
    ...product,
    rating: avgRating,
    reviews: allReviews.length,
    reviewList: allReviews,
  }

  await execute('UPDATE products SET data = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(updated),
    new Date().toISOString(),
    productId,
  ])
}

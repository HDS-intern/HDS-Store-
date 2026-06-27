import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest } from '@/lib/auth'
import {
  getMergedReviewsForProduct,
  getUserReviewForProduct,
  hasUserPurchasedProduct,
  submitReview,
} from '@/lib/reviews'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: productId } = await context.params
    const token = getTokenFromRequest(request)
    const user = await getUserBySession(token)

    const reviews = await getMergedReviewsForProduct(productId)
    const userReview = user ? await getUserReviewForProduct(user.id, productId) : null
    const purchase = user
      ? await hasUserPurchasedProduct(user.id, productId)
      : { purchased: false }

    return NextResponse.json({
      reviews,
      userReview,
      canReview: Boolean(user && user.role === 'customer' && purchase.purchased && !userReview),
      purchased: purchase.purchased,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: productId } = await context.params
    const token = getTokenFromRequest(request)
    const user = await getUserBySession(token)

    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Login required to submit a review' }, { status: 401 })
    }

    const body = await request.json()
    const { rating, title, comment, orderId } = body

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }
    if (!title?.trim() || !comment?.trim()) {
      return NextResponse.json({ error: 'Title and comment are required' }, { status: 400 })
    }

    const review = await submitReview({
      productId,
      userId: user.id,
      orderId,
      rating: Number(rating),
      title,
      comment,
    })

    const reviews = await getMergedReviewsForProduct(productId)
    return NextResponse.json({ review, reviews })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit review'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

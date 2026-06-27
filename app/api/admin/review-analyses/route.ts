import { NextResponse } from 'next/server'
import { getUserBySession, getTokenFromRequest, requirePermission } from '@/lib/auth'
import {
  getBadReviewChart,
  getBadReviewEntries,
  getBadReviewProducts,
  getGoodReviewEntries,
  getProductReviewScores,
} from '@/lib/badReviewAnalyses'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    requirePermission(await getUserBySession(getTokenFromRequest(request)), 'dashboard')

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId') || undefined

    return NextResponse.json({
      chart: await getBadReviewChart(productId),
      products: await getBadReviewProducts(),
      entries: await getBadReviewEntries(productId),
      goodEntries: await getGoodReviewEntries(productId),
      productScores: await getProductReviewScores(),
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

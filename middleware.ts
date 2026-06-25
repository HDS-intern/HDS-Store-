import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * In development, allow API auth requests from other devices on the LAN
 * (same app opened via http://<host-ip>:3000).
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin')
  const corsHeaders = new Headers()

  if (origin) {
    corsHeaders.set('Access-Control-Allow-Origin', origin)
    corsHeaders.set('Access-Control-Allow-Credentials', 'true')
  }

  corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  corsHeaders.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-session-token, x-guest-chat-id'
  )

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
  }

  const response = NextResponse.next()
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value)
  })
  return response
}

export const config = {
  matcher: '/api/:path*',
}

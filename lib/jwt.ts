import jwt from 'jsonwebtoken'

export type JwtPayload = {
  sub: string
  role: string
  username: string
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to .env.local (see .env.example).')
  }
  return secret
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret())
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      return null
    }
    const { sub, role, username } = decoded as JwtPayload
    if (!sub || !role || !username) return null
    return { sub, role, username }
  } catch {
    return null
  }
}

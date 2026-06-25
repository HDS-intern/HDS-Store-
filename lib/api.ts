import { generateClientUuid } from '@/lib/utils'

const TOKEN_KEY = 'hds_session_token'
const GUEST_CHAT_KEY = 'hds_guest_chat_id'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getGuestChatId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(GUEST_CHAT_KEY)
  if (!id) {
    id = `guest-${generateClientUuid()}`
    localStorage.setItem(GUEST_CHAT_KEY, id)
  }
  return id
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()

  if (!text) {
    throw new Error(res.ok ? 'Empty server response' : `Request failed (${res.status})`)
  }

  if (
    !contentType.includes('application/json') &&
    (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html'))
  ) {
    throw new Error(
      'Server returned an error page instead of data. Restart `npm run dev` and open the site using the same address shown in the terminal (localhost or your LAN IP).'
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : `Request failed (${res.status})`)
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12_000
): Promise<T> {
  const token = getStoredToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  } else {
    const guestId = getGuestChatId()
    if (guestId) {
      ;(headers as Record<string, string>)['x-guest-chat-id'] = guestId
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    const data = await readJsonResponse<{ error?: string } & T>(res)
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export const X_BASE_URL = '/xapi/2'

export class XAPIError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'XAPIError'
    this.status = status
  }
}

function getBearerToken(): string {
  const raw = localStorage.getItem('x-intel-auth')
  if (!raw) throw new XAPIError('X bearer token not set', 401)
  try {
    const parsed = JSON.parse(raw)
    const token = parsed?.state?.bearerToken
    if (!token) throw new XAPIError('X bearer token not set', 401)
    return token
  } catch {
    throw new XAPIError('X bearer token not set', 401)
  }
}

export async function xapi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${X_BASE_URL}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${getBearerToken()}` },
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      message = err?.detail || err?.errors?.[0]?.detail || err?.title || message
    } catch { /* use default */ }
    throw new XAPIError(message, res.status)
  }

  return res.json() as Promise<T>
}

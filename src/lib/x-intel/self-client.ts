// Client for the OAuth-connected user's OWN X data ("Profile" tab).
//
// Unlike x-client.ts (app-only bearer token, target analysis), this path uses
// the user-context OAuth session held server-side in HttpOnly cookies. The
// browser never sees the token: every call goes through our /api/x/proxy/*
// serverless function, which attaches the token and forwards to the X API.
//
// In dev there are no serverless functions, so the Vite proxy forwards /api to
// `vercel dev` (see vite.config.ts). Requests always include credentials so the
// auth cookies ride along.
import { XAPIError } from './x-client'

const PROXY_BASE = '/api/x/proxy'

/** Whether the user has a live OAuth session (connected their own account). */
export async function getSelfSession(): Promise<{ connected: boolean }> {
  try {
    const res = await fetch('/api/x/session', { credentials: 'same-origin' })
    if (!res.ok) return { connected: false }
    return (await res.json()) as { connected: boolean }
  } catch {
    return { connected: false }
  }
}

/** Begin the OAuth login redirect. Full-page navigation to the server route. */
export function beginSelfLogin(): void {
  window.location.href = '/api/x/oauth/login'
}

export async function selfLogout(): Promise<void> {
  try {
    await fetch('/api/x/logout', { method: 'POST', credentials: 'same-origin' })
  } catch { /* best-effort */ }
}

/** Authenticated GET against the connected user's X data via the server proxy. */
export async function selfApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const clean = path.startsWith('/') ? path.slice(1) : path
  const res = await fetch(`${PROXY_BASE}/${clean}${qs ? `?${qs}` : ''}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const err = await res.json()
      message = err?.error || err?.detail || err?.errors?.[0]?.detail || err?.title || message
    } catch { /* keep default */ }
    throw new XAPIError(message, res.status)
  }
  return res.json() as Promise<T>
}

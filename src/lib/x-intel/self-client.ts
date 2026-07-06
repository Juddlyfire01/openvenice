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
import { useXSelfStore } from '../../stores/x-self-store'

const PROXY_BASE = '/api/x/proxy'

/** Whether the user has a live OAuth session (connected their own account). */
export async function getSelfSession(): Promise<{ connected: boolean }> {
  try {
    const res = await fetch('/api/x/session', { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return { connected: false }
    return (await res.json()) as { connected: boolean }
  } catch {
    return { connected: false }
  }
}

/** Begin the OAuth login redirect. Flips the store into the connecting state
 *  and stashes a sessionStorage flag so the remounted app can keep showing the
 *  connecting UI until the session probe resolves. The redirect is deferred one
 *  paint frame (double rAF) so the connecting state actually renders before the
 *  browser navigates away. */
export function beginSelfLogin(): void {
  useXSelfStore.getState().setConnecting(true)
  try { sessionStorage.setItem('x_oauth_in_progress', '1') } catch { /* private mode / disabled */ }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.location.href = '/api/x/oauth/login'
  }))
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

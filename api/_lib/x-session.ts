// Server-side session helper: resolve a currently-valid X access token from the
// request cookies, transparently refreshing it when it has expired (or is about
// to). Returns the token plus any Set-Cookie headers the caller must forward so
// the refreshed token is persisted back to the browser.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  COOKIE, readEnv, refreshAccessToken, parseCookies, serializeCookie, clearCookie,
  cookiesAreSecure,
} from './x-oauth.js'

// Refresh a bit early so in-flight requests never race the expiry boundary.
const REFRESH_SKEW_MS = 60_000

export interface ResolvedSession {
  accessToken: string
  setCookies: string[] // forward via res.setHeader('Set-Cookie', …)
}

/** Returns a valid access token or null if the user isn't connected. */
export async function resolveSession(req: VercelRequest): Promise<ResolvedSession | null> {
  const cookies = parseCookies(req.headers.cookie)
  const access = cookies[COOKIE.access]
  const refresh = cookies[COOKIE.refresh]
  const expiry = Number(cookies[COOKIE.expiry] ?? 0)

  const stillValid = access && expiry && Date.now() < expiry - REFRESH_SKEW_MS
  if (stillValid) return { accessToken: access, setCookies: [] }

  if (!refresh) return null // nothing to refresh with → treat as disconnected

  const env = readEnv(req)
  const token = await refreshAccessToken(env, refresh)
  const expiryMs = Date.now() + token.expires_in * 1000
  const secure = cookiesAreSecure(req)
  const setCookies = [
    serializeCookie(COOKIE.access, token.access_token, { maxAge: token.expires_in, secure }),
    serializeCookie(COOKIE.expiry, String(expiryMs), { maxAge: 60 * 60 * 24 * 30, secure }),
  ]
  // X may rotate the refresh token; persist the new one when present.
  if (token.refresh_token) {
    setCookies.push(serializeCookie(COOKIE.refresh, token.refresh_token, { maxAge: 60 * 60 * 24 * 60, secure }))
  }
  return { accessToken: token.access_token, setCookies }
}

/** Clear every auth cookie (logout / unrecoverable refresh failure). */
export function clearSessionCookies(res: VercelResponse) {
  res.setHeader('Set-Cookie', [
    clearCookie(COOKIE.access),
    clearCookie(COOKIE.refresh),
    clearCookie(COOKIE.expiry),
  ])
}

// Shared helpers for the X (Twitter) OAuth 2.0 Authorization Code + PKCE flow.
// Used by the /api/x/oauth/* serverless functions. Everything here is
// server-side only — secrets and tokens must never reach the browser bundle.
import crypto from 'node:crypto'

export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
export const X_API_BASE = 'https://api.x.com/2'

// Scopes we request. offline.access is required to receive a refresh_token so
// the 2-hour access token can be renewed without bouncing the user through
// consent again. The rest are read scopes matching the Profile tab's needs.
export const X_SCOPES = [
  'tweet.read',
  'users.read',
  'bookmark.read',
  'like.read',
  'offline.access',
] as const

// Cookie names. All are HttpOnly so client JS can never read the token/verifier.
export const COOKIE = {
  verifier: 'x_pkce_verifier',
  state: 'x_oauth_state',
  access: 'x_access_token',
  refresh: 'x_refresh_token',
  expiry: 'x_token_expiry', // epoch ms when the access token expires
} as const

export interface XOAuthEnv {
  clientId: string
  clientSecret: string | null // null → public client (PKCE only)
  redirectUri: string
  appBaseUrl: string // where to send the user after callback
}

/** Read + validate the OAuth env vars once, with clear errors if misconfigured. */
export function readEnv(): XOAuthEnv {
  const clientId = process.env.X_CLIENT_ID
  const redirectUri = process.env.X_REDIRECT_URI
  if (!clientId) throw new Error('X_CLIENT_ID is not set')
  if (!redirectUri) throw new Error('X_REDIRECT_URI is not set')
  return {
    clientId,
    clientSecret: process.env.X_CLIENT_SECRET || null,
    redirectUri,
    appBaseUrl: process.env.APP_BASE_URL || '/',
  }
}

// ——— PKCE ———

export function randomUrlToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function codeChallengeS256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// ——— Cookies ———

export interface CookieOpts {
  maxAge?: number // seconds
  httpOnly?: boolean
  path?: string
}

export function serializeCookie(name: string, value: string, opts: CookieOpts = {}): string {
  const parts = [`${name}=${value}`]
  parts.push(`Path=${opts.path ?? '/'}`)
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.httpOnly !== false) parts.push('HttpOnly')
  parts.push('Secure')
  parts.push('SameSite=Lax')
  return parts.join('; ')
}

/** Expire a cookie by name (Max-Age=0). */
export function clearCookie(name: string): string {
  return serializeCookie(name, '', { maxAge: 0 })
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

// ——— Token endpoint ———

export interface XTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number // seconds
  scope?: string
  token_type: string
}

/** Build the Authorization header for the token endpoint when using a
 *  confidential client (client secret present). Public clients omit this. */
function basicAuthHeader(env: XOAuthEnv): Record<string, string> {
  if (!env.clientSecret) return {}
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64')
  return { Authorization: `Basic ${basic}` }
}

export async function exchangeCode(env: XOAuthEnv, code: string, verifier: string): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.redirectUri,
    code_verifier: verifier,
    client_id: env.clientId,
  })
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...basicAuthHeader(env) },
    body,
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<XTokenResponse>
}

export async function refreshAccessToken(env: XOAuthEnv, refreshToken: string): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.clientId,
  })
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...basicAuthHeader(env) },
    body,
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<XTokenResponse>
}

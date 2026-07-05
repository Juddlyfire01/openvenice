// GET /api/x/oauth/callback?code=...&state=...
// X redirects here after the user consents. We verify the CSRF state, exchange
// the code for tokens using the stored PKCE verifier, persist the tokens in
// HttpOnly cookies (never exposed to client JS), clear the transient cookies,
// and bounce the user back into the app.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  COOKIE, readEnv, exchangeCode, parseCookies, serializeCookie, clearCookie,
} from '../../_lib/x-oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const env = readEnv()
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const error = typeof req.query.error === 'string' ? req.query.error : ''

    if (error) return bounce(res, env.appBaseUrl, `x_error=${encodeURIComponent(error)}`)
    if (!code || !state) return bounce(res, env.appBaseUrl, 'x_error=missing_code')

    const cookies = parseCookies(req.headers.cookie)
    if (!cookies[COOKIE.state] || cookies[COOKIE.state] !== state) {
      return bounce(res, env.appBaseUrl, 'x_error=state_mismatch')
    }
    const verifier = cookies[COOKIE.verifier]
    if (!verifier) return bounce(res, env.appBaseUrl, 'x_error=missing_verifier')

    const token = await exchangeCode(env, code, verifier)
    const expiryMs = Date.now() + token.expires_in * 1000

    const cookieHeaders = [
      // Access token lives as long as it's valid; refresh token long-lived.
      serializeCookie(COOKIE.access, token.access_token, { maxAge: token.expires_in }),
      serializeCookie(COOKIE.expiry, String(expiryMs), { maxAge: 60 * 60 * 24 * 30 }),
      // Clear the one-shot PKCE cookies.
      clearCookie(COOKIE.verifier),
      clearCookie(COOKIE.state),
    ]
    if (token.refresh_token) {
      cookieHeaders.push(serializeCookie(COOKIE.refresh, token.refresh_token, { maxAge: 60 * 60 * 24 * 60 }))
    }

    res.setHeader('Set-Cookie', cookieHeaders)
    return bounce(res, env.appBaseUrl, 'x_connected=1')
  } catch (e) {
    const env = safeEnv()
    return bounce(res, env, `x_error=${encodeURIComponent(e instanceof Error ? e.message : 'callback_failed')}`)
  }
}

function safeEnv(): string {
  return process.env.APP_BASE_URL || '/'
}

function bounce(res: VercelResponse, base: string, query: string) {
  const sep = base.includes('?') ? '&' : '?'
  res.setHeader('Location', `${base}${sep}${query}`)
  res.status(302).end()
}

// GET /api/x/oauth/callback?code=...&state=...
// X redirects here after the user consents. We verify the CSRF state, exchange
// the code for tokens using the stored PKCE verifier, persist the tokens in
// HttpOnly cookies (never exposed to client JS), clear the transient cookies,
// and bounce the user back into the app.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  COOKIE, readEnv, exchangeCode, parseCookies, serializeCookie, clearCookie,
  cookiesAreSecure, unpackOAuthState,
} from '../../_lib/x-oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const env = readEnv(req)
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const error = typeof req.query.error === 'string' ? req.query.error : ''

    if (error) return bounce(res, env.appBaseUrl, `x_error=${encodeURIComponent(error)}`)
    if (!code || !state) return bounce(res, env.appBaseUrl, 'x_error=missing_code')

    // Prefer signed state (survives cross-site redirect without cookies). Fall back
    // to legacy PKCE cookies for in-flight logins started before deploy.
    const cookies = parseCookies(req.headers.cookie)
    let verifier = unpackOAuthState(state)
    if (!verifier && cookies[COOKIE.state] === state && cookies[COOKIE.verifier]) {
      verifier = cookies[COOKIE.verifier]
    }
    if (!verifier) return bounce(res, env.appBaseUrl, 'x_error=invalid_state')

    const token = await exchangeCode(env, code, verifier)
    const expiryMs = Date.now() + token.expires_in * 1000
    const secure = cookiesAreSecure(req)

    const cookieHeaders = [
      // Access token lives as long as it's valid; refresh token long-lived.
      serializeCookie(COOKIE.access, token.access_token, { maxAge: token.expires_in, secure }),
      serializeCookie(COOKIE.expiry, String(expiryMs), { maxAge: 60 * 60 * 24 * 30, secure }),
      // Clear the one-shot PKCE cookies.
      clearCookie(COOKIE.verifier),
      clearCookie(COOKIE.state),
    ]
    if (token.refresh_token) {
      cookieHeaders.push(serializeCookie(COOKIE.refresh, token.refresh_token, { maxAge: 60 * 60 * 24 * 60, secure }))
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

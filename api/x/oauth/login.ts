// GET /api/x/oauth/login
// Starts the X OAuth 2.0 Authorization Code + PKCE flow. Generates a PKCE
// verifier + CSRF state, stashes them in short-lived HttpOnly cookies, and
// 302-redirects the browser to X's consent screen.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  X_AUTHORIZE_URL, X_SCOPES, COOKIE,
  readEnv, randomUrlToken, codeChallengeS256, serializeCookie,
} from '../../_lib/x-oauth.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const env = readEnv()
    const verifier = randomUrlToken(32)
    const state = randomUrlToken(16)
    const challenge = codeChallengeS256(verifier)

    const authUrl = new URL(X_AUTHORIZE_URL)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', env.clientId)
    authUrl.searchParams.set('redirect_uri', env.redirectUri)
    authUrl.searchParams.set('scope', X_SCOPES.join(' '))
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    // 10 min is plenty to complete the consent round-trip.
    const short = { maxAge: 600 }
    res.setHeader('Set-Cookie', [
      serializeCookie(COOKIE.verifier, verifier, short),
      serializeCookie(COOKIE.state, state, short),
    ])
    res.setHeader('Location', authUrl.toString())
    res.status(302).end()
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'OAuth login failed' })
  }
}

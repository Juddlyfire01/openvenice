// GET /api/x/session
// Lightweight "am I connected?" probe for the client. Returns { connected }
// without ever exposing the token. Used to decide whether the Profile tab shows
// its connected state or the "Connect X" call-to-action.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveSession } from '../_lib/x-session.js'

function send(res: VercelResponse, body: { connected: boolean }) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.status(200).json(body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const session = await resolveSession(req)
    if (!session) return send(res, { connected: false })
    if (session.setCookies.length) res.setHeader('Set-Cookie', session.setCookies)
    send(res, { connected: true })
  } catch {
    // A failed refresh means the stored grant is dead — report disconnected.
    send(res, { connected: false })
  }
}

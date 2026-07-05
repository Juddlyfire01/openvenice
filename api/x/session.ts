// GET /api/x/session
// Lightweight "am I connected?" probe for the client. Returns { connected }
// without ever exposing the token. Used to decide whether the Profile tab shows
// its connected state or the "Connect X" call-to-action.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveSession } from '../_lib/x-session.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const session = await resolveSession(req)
    if (!session) return res.status(200).json({ connected: false })
    if (session.setCookies.length) res.setHeader('Set-Cookie', session.setCookies)
    res.status(200).json({ connected: true })
  } catch {
    // A failed refresh means the stored grant is dead — report disconnected.
    res.status(200).json({ connected: false })
  }
}

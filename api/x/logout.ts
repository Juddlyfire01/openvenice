// POST /api/x/logout
// Clears the X auth cookies. (Does not revoke at X; the tokens simply become
// inaccessible to this app and expire naturally.)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookies } from '../_lib/x-session.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  clearSessionCookies(res)
  res.status(200).json({ ok: true })
}

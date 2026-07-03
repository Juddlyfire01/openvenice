import { X_BASE_URL } from './x-client'
import { USER_FIELDS, DEFAULT_TARGET } from './fields'
import { normalizeProfile } from './normalize'
import type { Profile, XUserRaw, XSingleResponse } from './types'

export type XKeyValidation =
  | { ok: true; profile?: Profile }
  | { ok: false; message: string }

// The X API has no free "whoami" for an app-only bearer token, so we validate
// with the cheapest authenticated read: a single user lookup. We target
// DEFAULT_TARGET and request full USER_FIELDS, so a successful validation also
// yields that account's profile — the caller can seed it as the first target
// without spending a second request.
//   200 → valid app-only bearer token (profile returned when parseable)
//   401 → invalid / revoked token
//   403 → authenticated but the app tier lacks access (still a "real" token)
// We reuse the client's X_BASE_URL so this works in dev (Vite proxy) and prod
// alike, rather than hardcoding a dev-only path.
export async function validateXKey(token: string): Promise<XKeyValidation> {
  try {
    const qs = new URLSearchParams({ 'user.fields': USER_FIELDS.join(',') }).toString()
    const res = await fetch(`${X_BASE_URL}/users/by/username/${DEFAULT_TARGET}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      // The token is valid regardless of whether we can use the body. Try to
      // extract a profile, but never fail validation over a parse hiccup.
      try {
        const body = (await res.json()) as XSingleResponse<XUserRaw>
        if (body?.data) return { ok: true, profile: normalizeProfile(body.data) }
      } catch { /* fall through to bare ok */ }
      return { ok: true }
    }
    if (res.status === 401) return { ok: false, message: 'Invalid bearer token' }
    if (res.status === 403) return { ok: false, message: 'Token lacks read access' }
    if (res.status === 429) return { ok: false, message: 'Rate limited — try again shortly' }
    return { ok: false, message: `X returned ${res.status}` }
  } catch {
    return { ok: false, message: 'Could not reach X' }
  }
}

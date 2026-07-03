import { X_BASE_URL } from './x-client'
import { USER_FIELDS, DEFAULT_TARGET } from './fields'
import { normalizeProfile } from './normalize'
import type { Profile, XUserRaw, XSingleResponse } from './types'

export type XKeyValidation =
  | { ok: true; profile: Profile | null }
  | { ok: false; message: string }

// The X API has no free "whoami" for an app-only bearer token, so we validate
// with the cheapest authenticated read: a single user lookup. We look up the
// DEFAULT_TARGET account, so a successful validation ALSO returns that profile
// — the caller can seed it as the first target with no extra request/cost.
//   200 → valid app-only bearer token (profile returned when the body parses)
//   401 → invalid / revoked token
//   403 → authenticated but the app tier lacks access (still a "real" token)
//   429 → rate limited
// We reuse the client's X_BASE_URL so this works in dev (Vite proxy) and prod
// alike, rather than hardcoding a dev-only path.
export async function validateXKey(token: string): Promise<XKeyValidation> {
  try {
    const qs = new URLSearchParams({ 'user.fields': USER_FIELDS.join(',') }).toString()
    const res = await fetch(
      `${X_BASE_URL}/users/by/username/${encodeURIComponent(DEFAULT_TARGET)}?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.ok) {
      let profile: Profile | null = null
      try {
        const body = (await res.json()) as XSingleResponse<XUserRaw>
        if (body?.data) profile = normalizeProfile(body.data)
      } catch { /* token is valid; seeding is best-effort */ }
      return { ok: true, profile }
    }
    if (res.status === 401) return { ok: false, message: 'Invalid bearer token' }
    if (res.status === 403) return { ok: false, message: 'Token lacks read access' }
    if (res.status === 429) return { ok: false, message: 'Rate limited — try again shortly' }
    return { ok: false, message: `X returned ${res.status}` }
  } catch {
    return { ok: false, message: 'Could not reach X' }
  }
}

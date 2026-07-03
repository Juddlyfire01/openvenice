import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateXKey } from './validate-x-key'
import { DEFAULT_TARGET } from './fields'

// A 200 with no parseable body: token is valid but no profile extracted.
const okNoBody = { ok: true, status: 200, json: () => Promise.reject(new Error('no body')) }

describe('validateXKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok when the lookup responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okNoBody))
    const result = await validateXKey('AAAA-valid')
    expect(result).toEqual({ ok: true })
  })

  it('returns the normalized profile when the 200 body is parseable', async () => {
    const body = { data: { id: '42', name: 'Ask Venice', username: 'AskVenice', verified_type: 'business' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }))
    const result = await validateXKey('AAAA-valid')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile?.username).toBe('AskVenice')
      expect(result.profile?.verified.type).toBe('business')
    }
  })

  it('still returns ok (no profile) when the 200 body cannot be parsed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okNoBody))
    const result = await validateXKey('AAAA-valid')
    expect(result).toEqual({ ok: true })
  })

  it('returns invalid message on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const result = await validateXKey('AAAA-bogus')
    expect(result).toEqual({ ok: false, message: 'Invalid bearer token' })
  })

  it('returns lacks-access message on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    const result = await validateXKey('AAAA-underprivileged')
    expect(result).toEqual({ ok: false, message: 'Token lacks read access' })
  })

  it('returns rate-limit message on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const result = await validateXKey('AAAA-valid')
    expect(result).toEqual({ ok: false, message: 'Rate limited — try again shortly' })
  })

  it('returns generic message on unexpected status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const result = await validateXKey('AAAA-valid')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('500')
  })

  it('returns network error message when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await validateXKey('AAAA-valid')
    expect(result).toEqual({ ok: false, message: 'Could not reach X' })
  })

  it('looks up the default target with user fields and the candidate Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okNoBody)
    vi.stubGlobal('fetch', fetchMock)
    await validateXKey('AAAA-my-token')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain(`/xapi/2/users/by/username/${DEFAULT_TARGET}`)
    expect(url).toContain('user.fields=')
    expect(init).toEqual({ headers: { Authorization: 'Bearer AAAA-my-token' } })
  })
})

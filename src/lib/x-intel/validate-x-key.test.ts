import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateXKey } from './validate-x-key'

describe('validateXKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok when the lookup responds 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
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

  it('sends the candidate token as a Bearer token to the lookup endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    await validateXKey('AAAA-my-token')
    expect(fetchMock).toHaveBeenCalledWith('/xapi/2/users/by/username/X', {
      headers: { Authorization: 'Bearer AAAA-my-token' },
    })
  })
})

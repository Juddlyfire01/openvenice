import { describe, it, expect } from 'vitest'
import { parseSynthesis } from './synthesize'

const validJson = JSON.stringify({
  themes: ['crypto/AI convergence', 'anti-surveillance'],
  register: 'sardonic, declarative',
  recurringTopics: [{ topic: 'Venice API', postCount: 12, lastSeen: '2026-07-01' }],
  postingCadence: { pattern: 'burst', peakWindowsUtc: ['14:00-18:00'], avgPerDay: 4.2, variance: 'high' },
  flagshipPost: { postId: '999', excerpt: 'gm builders', metrics: { impressions: 10000, likes: 500, reposts: 60, replies: 40, quotes: 10, bookmarks: 25 } },
})

describe('parseSynthesis', () => {
  it('parses a fenced JSON response', () => {
    const content = 'Here is the profile:\n```json\n' + validJson + '\n```\nDone.'
    const result = parseSynthesis(content, 'venice-uncensored-1-2')
    expect(result.themes).toHaveLength(2)
    expect(result.register).toBe('sardonic, declarative')
    expect(result.postingCadence.pattern).toBe('burst')
    expect(result.model).toBe('venice-uncensored-1-2')
    expect(result.synthesizedAt).toBeTruthy()
  })

  it('parses bare JSON without fences', () => {
    const result = parseSynthesis(validJson, 'm')
    expect(result.flagshipPost.postId).toBe('999')
  })

  it('throws a helpful error on unparseable content', () => {
    expect(() => parseSynthesis('total garbage, no json here', 'm')).toThrow(/parse/i)
  })

  it('fills defaults for missing optional arrays', () => {
    const partial = JSON.stringify({
      themes: [], register: 'flat',
      postingCadence: { pattern: 'steady', peakWindowsUtc: [], avgPerDay: 1, variance: 'low' },
      flagshipPost: { postId: '', excerpt: '', metrics: { impressions: 0, likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 } },
    })
    const result = parseSynthesis(partial, 'm')
    expect(result.recurringTopics).toEqual([])
  })

  it('falls back to bare JSON when fenced content is truncated by embedded backticks', () => {
    // Simulate a response where the JSON contains triple backticks, truncating the fence extraction
    const content = '```json\n{"themes": ["test"], "broken": ```}\n```\n' + validJson
    const result = parseSynthesis(content, 'm')
    // The first fence is truncated and won't parse; the fallback to full content finds validJson
    expect(result.flagshipPost.postId).toBe('999')
  })

  it('throws when Venices returns empty choices (via synthesizeProfile guard)', () => {
    // This is tested via the guard in synthesizeProfile, not parseSynthesis
    // Just verify parseSynthesis still throws on truly empty content
    expect(() => parseSynthesis('', 'm')).toThrow(/parse/i)
  })
})

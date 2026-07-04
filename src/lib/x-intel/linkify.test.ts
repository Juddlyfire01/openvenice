import { describe, it, expect } from 'vitest'
import { linkify } from './linkify'

describe('linkify', () => {
  it('returns a single text token for plain text', () => {
    expect(linkify('just plain words')).toEqual([{ type: 'text', value: 'just plain words' }])
  })

  it('extracts a url token', () => {
    const t = linkify('Private & Unrestricted AI | https://t.co/iIt1pyF1TK')
    expect(t[0]).toEqual({ type: 'text', value: 'Private & Unrestricted AI | ' })
    expect(t[1]).toEqual({ type: 'url', value: 'https://t.co/iIt1pyF1TK', href: 'https://t.co/iIt1pyF1TK' })
  })

  it('trims trailing punctuation off a url', () => {
    const t = linkify('see https://example.com/page, ok')
    expect(t[1]).toEqual({ type: 'url', value: 'https://example.com/page', href: 'https://example.com/page' })
    expect(t[2]).toEqual({ type: 'text', value: ',' })
    expect(t[3]).toEqual({ type: 'text', value: ' ok' })
  })

  it('extracts mention tokens', () => {
    const t = linkify('follows @ErikVoorhees closely')
    expect(t[1]).toEqual({ type: 'mention', value: '@ErikVoorhees', username: 'ErikVoorhees' })
  })

  it('extracts hashtag tokens', () => {
    const t = linkify('building #crypto and #AI')
    expect(t.find((x) => x.type === 'hashtag')).toEqual({ type: 'hashtag', value: '#crypto', tag: 'crypto' })
  })

  it('handles a mention at the very start', () => {
    const t = linkify('@venice_ai builds tools')
    expect(t[0]).toEqual({ type: 'mention', value: '@venice_ai', username: 'venice_ai' })
  })

  it('does not treat an email-like @ as a mention', () => {
    const t = linkify('contact me at foo@bar for details')
    expect(t.every((x) => x.type !== 'mention')).toBe(true)
  })

  it('mixes multiple token types in order', () => {
    const t = linkify('@a #b https://x.co done')
    expect(t.map((x) => x.type)).toEqual(['mention', 'text', 'hashtag', 'text', 'url', 'text'])
  })
})

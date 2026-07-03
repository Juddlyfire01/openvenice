// src/lib/x-intel/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeProfile, normalizePost, deriveEdges } from './normalize'
import type { XUserRaw, XPostRaw } from './types'

const rawUser: XUserRaw = {
  id: '42', name: 'Erik Voorhees', username: 'ErikVoorhees',
  verified: false, verified_type: 'blue',
  description: 'Building freedom tech', location: 'Earth',
  url: 'https://t.co/abc', profile_image_url: 'https://pbs.twimg.com/x.jpg',
  pinned_tweet_id: '900', most_recent_tweet_id: '999',
  created_at: '2011-04-01T00:00:00.000Z',
  public_metrics: { followers_count: 700000, following_count: 4499, tweet_count: 50000, listed_count: 5000, like_count: 30000, media_count: 1200 },
}

const rawPost: XPostRaw = {
  id: '999', text: 'gm @venice_ai builders', author_id: '42', lang: 'en',
  created_at: '2026-07-01T12:00:00.000Z',
  public_metrics: { impression_count: 10000, like_count: 500, retweet_count: 60, reply_count: 40, quote_count: 10, bookmark_count: 25 },
  referenced_tweets: [{ type: 'quoted', id: '888' }],
  entities: {
    urls: [{ expanded_url: 'https://venice.ai', display_url: 'venice.ai', title: 'Venice' }],
    mentions: [{ username: 'venice_ai', id: '77' }],
  },
  attachments: { media_keys: ['3_abc'] },
  context_annotations: [{ domain: { name: 'Technology' }, entity: { name: 'AI' } }],
}

describe('normalizeProfile', () => {
  it('maps raw user to Profile with verification type', () => {
    const p = normalizeProfile(rawUser)
    expect(p.id).toBe('42')
    expect(p.username).toBe('ErikVoorhees')
    expect(p.verified).toEqual({ legacy: false, type: 'blue' })
    expect(p.metrics.followers).toBe(700000)
    expect(p.pinnedPostId).toBe('900')
    expect(p.mostRecentPostId).toBe('999')
    expect(p.gatheredAt).toBeTruthy()
  })

  it('treats verified_type "none" and missing fields as nulls/zeros', () => {
    const p = normalizeProfile({ id: '1', name: 'x', username: 'x', verified_type: 'none' })
    expect(p.verified.type).toBeNull()
    expect(p.bio).toBeNull()
    expect(p.metrics.followers).toBe(0)
  })
})

describe('normalizePost', () => {
  it('maps raw post to Post with derived kind', () => {
    const p = normalizePost(rawPost)
    expect(p.kind).toBe('quote')
    expect(p.metrics.likes).toBe(500)
    expect(p.mentions).toEqual([{ username: 'venice_ai', id: '77' }])
    expect(p.mediaKeys).toEqual(['3_abc'])
    expect(p.contextAnnotations).toEqual([{ domain: 'Technology', entity: 'AI' }])
  })

  it('derives kind for reply, retweet, original', () => {
    expect(normalizePost({ ...rawPost, referenced_tweets: [{ type: 'replied_to', id: '1' }] }).kind).toBe('reply')
    expect(normalizePost({ ...rawPost, referenced_tweets: [{ type: 'retweeted', id: '1' }] }).kind).toBe('retweet')
    expect(normalizePost({ ...rawPost, referenced_tweets: undefined }).kind).toBe('original')
  })
})

describe('deriveEdges', () => {
  it('counts mention edges across posts and tracks lastSeen', () => {
    const p1 = normalizePost(rawPost)
    const p2 = normalizePost({ ...rawPost, id: '998', created_at: '2026-06-30T12:00:00.000Z' })
    const edges = deriveEdges('42', [p1, p2])
    const mention = edges.find((e) => e.kind === 'mention' && e.targetUsername === 'venice_ai')
    expect(mention).toBeDefined()
    expect(mention!.weight).toBe(2)
    expect(mention!.lastSeen).toBe('2026-07-01T12:00:00.000Z')
    expect(mention!.source).toBe('42')
  })

  it('creates quote/reply edges keyed to referenced post ids when author unknown', () => {
    const p = normalizePost(rawPost) // quoted post 888, author unknown
    const edges = deriveEdges('42', [p])
    const quote = edges.find((e) => e.kind === 'quote')
    expect(quote).toBeDefined()
    expect(quote!.target).toBe('post:888') // placeholder until resolved
    expect(quote!.targetUsername).toBe('')
  })

  it('returns empty array for no posts', () => {
    expect(deriveEdges('42', [])).toEqual([])
  })
})

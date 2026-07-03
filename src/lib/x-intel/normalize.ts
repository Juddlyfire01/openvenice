// src/lib/x-intel/normalize.ts
import type { XUserRaw, XPostRaw, Profile, Post, Edge } from './types'

export function normalizeProfile(raw: XUserRaw): Profile {
  const m = raw.public_metrics
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.name,
    avatarUrl: raw.profile_image_url ?? '',
    bio: raw.description || null,
    location: raw.location || null,
    url: raw.url || null,
    verified: {
      legacy: raw.verified ?? false,
      type: raw.verified_type && raw.verified_type !== 'none' ? raw.verified_type : null,
    },
    metrics: {
      followers: m?.followers_count ?? 0,
      following: m?.following_count ?? 0,
      posts: m?.tweet_count ?? 0,
      likes: m?.like_count ?? 0,
      listed: m?.listed_count ?? 0,
      media: m?.media_count ?? 0,
    },
    accountCreated: raw.created_at ?? '',
    pinnedPostId: raw.pinned_tweet_id ?? null,
    mostRecentPostId: raw.most_recent_tweet_id ?? null,
    gatheredAt: new Date().toISOString(),
  }
}

const KIND_MAP: Record<string, Post['kind']> = {
  replied_to: 'reply',
  quoted: 'quote',
  retweeted: 'retweet',
}

export function normalizePost(raw: XPostRaw): Post {
  const m = raw.public_metrics
  const ref = raw.referenced_tweets?.[0]
  return {
    id: raw.id,
    authorId: raw.author_id ?? '',
    text: raw.text,
    lang: raw.lang ?? 'und',
    createdAt: raw.created_at ?? '',
    metrics: {
      impressions: m?.impression_count ?? 0,
      likes: m?.like_count ?? 0,
      reposts: m?.retweet_count ?? 0,
      replies: m?.reply_count ?? 0,
      quotes: m?.quote_count ?? 0,
      bookmarks: m?.bookmark_count ?? 0,
    },
    kind: ref ? (KIND_MAP[ref.type] ?? 'original') : 'original',
    referenced: raw.referenced_tweets?.map((r) => ({ id: r.id, type: r.type })) ?? [],
    urls: raw.entities?.urls?.map((u) => ({ expanded: u.expanded_url, display: u.display_url, title: u.title })) ?? [],
    mentions: raw.entities?.mentions?.map((mn) => ({ username: mn.username, id: mn.id ?? '' })) ?? [],
    mediaKeys: raw.attachments?.media_keys ?? [],
    contextAnnotations: raw.context_annotations?.map((c) => ({ domain: c.domain.name, entity: c.entity.name })) ?? [],
    gatheredAt: new Date().toISOString(),
  }
}

export function deriveEdges(sourceUserId: string, posts: Post[]): Edge[] {
  const map = new Map<string, Edge>()

  const bump = (key: string, edge: Omit<Edge, 'weight'>) => {
    const existing = map.get(key)
    if (existing) {
      existing.weight += 1
      if (edge.lastSeen > existing.lastSeen) existing.lastSeen = edge.lastSeen
    } else {
      map.set(key, { ...edge, weight: 1 })
    }
  }

  for (const post of posts) {
    for (const mn of post.mentions) {
      bump(`mention:${mn.username}`, {
        source: sourceUserId,
        target: mn.id || `user:${mn.username}`,
        targetUsername: mn.username,
        kind: 'mention',
        lastSeen: post.createdAt,
      })
    }
    for (const ref of post.referenced) {
      const kind = KIND_MAP[ref.type]
      if (!kind || kind === 'original') continue
      bump(`${kind}:${ref.id}`, {
        source: sourceUserId,
        target: `post:${ref.id}`, // placeholder — resolved to a user id on demand
        targetUsername: '',
        kind,
        lastSeen: post.createdAt,
      })
    }
  }

  return [...map.values()]
}

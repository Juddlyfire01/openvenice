export interface Profile {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bio: string | null
  location: string | null
  url: string | null
  verified: { legacy: boolean; type: 'blue' | 'business' | 'government' | null }
  metrics: { followers: number; following: number; posts: number; likes: number; listed: number; media: number }
  accountCreated: string  // ISO
  pinnedPostId: string | null
  mostRecentPostId: string | null
  gatheredAt: string      // ISO — when we last fetched this
}

export interface Post {
  id: string
  authorId: string
  text: string
  lang: string
  createdAt: string
  metrics: { impressions: number; likes: number; reposts: number; replies: number; quotes: number; bookmarks: number }
  kind: 'original' | 'reply' | 'quote' | 'retweet'
  referenced: { id: string; type: string }[]
  urls: { expanded: string; display: string; title?: string }[]
  mentions: { username: string; id: string }[]
  mediaKeys: string[]
  contextAnnotations: { domain: string; entity: string }[]
  gatheredAt: string
}

export interface Edge {
  source: string   // target user id
  target: string   // engaged user id (or username-keyed placeholder)
  targetUsername: string
  kind: 'quote' | 'reply' | 'mention' | 'retweet'
  weight: number   // occurrence count across gathered posts
  lastSeen: string
}

export interface CharacterProfile {
  themes: string[]
  register: string
  recurringTopics: { topic: string; postCount: number; lastSeen: string }[]
  postingCadence: { pattern: 'burst' | 'steady'; peakWindowsUtc: string[]; avgPerDay: number; variance: 'high' | 'medium' | 'low' }
  flagshipPost: { postId: string; excerpt: string; metrics: Post['metrics'] }
  synthesizedAt: string  // ISO
  model: string          // which Venice model produced this
}

export interface SynthesisSettings {
  contextCap: number    // default 80, user-adjustable 10–200
  temperature: number   // default 0.3, user-adjustable 0.0–1.0
  model: string         // default 'venice-uncensored-1-2'
}

export const DEFAULT_SYNTHESIS_SETTINGS: SynthesisSettings = {
  contextCap: 80,
  temperature: 0.3,
  model: 'venice-uncensored-1-2',
}

// ——— Raw X API v2 shapes (subset we request) ———

export interface XUserRaw {
  id: string
  name: string
  username: string
  verified?: boolean
  verified_type?: 'blue' | 'business' | 'government' | 'none'
  description?: string
  location?: string
  url?: string
  profile_image_url?: string
  pinned_tweet_id?: string
  most_recent_tweet_id?: string
  created_at?: string
  public_metrics?: {
    followers_count: number
    following_count: number
    tweet_count: number
    listed_count: number
    like_count?: number
    media_count?: number
  }
}

export interface XPostRaw {
  id: string
  text: string
  author_id?: string
  lang?: string
  created_at?: string
  public_metrics?: {
    impression_count?: number
    like_count: number
    retweet_count: number
    reply_count: number
    quote_count: number
    bookmark_count?: number
  }
  referenced_tweets?: { type: 'replied_to' | 'quoted' | 'retweeted'; id: string }[]
  entities?: {
    urls?: { expanded_url: string; display_url: string; title?: string }[]
    mentions?: { username: string; id?: string }[]
  }
  attachments?: { media_keys?: string[] }
  context_annotations?: { domain: { name: string }; entity: { name: string } }[]
}

export interface XPaginatedResponse<T> {
  data?: T[]
  meta?: { newest_id?: string; oldest_id?: string; result_count: number; next_token?: string }
  errors?: { title: string; detail: string }[]
}

export interface XSingleResponse<T> {
  data?: T
  errors?: { title: string; detail: string }[]
}

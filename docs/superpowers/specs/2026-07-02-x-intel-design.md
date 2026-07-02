# X Intel — Design Spec

**Date:** 2026-07-02
**Status:** Approved (pending user review)
**Branch:** `v3` of `Juddlyfire01/openvenice` (fork of `nikshepsvn/openvenice`)
**Tab name:** Intel (sidebar entry, slot 8, ⌘8)

## 1. Purpose

X Intel is a privacy-first, account-agnostic intelligence tab bolted onto OpenVenice. The user supplies their own X API credentials (stored locally, like the Venice API key); the user enters one or more target accounts to gather intel on; each target gets its own persisted intel report in the browser. The tool gathers, stores, presents, and helps the user decide — posting is explicitly out of scope for v1.

**Primary use case:** Build a dynamic character profile on Erik Voorhees and the Venice.ai team, track their posts and content, and produce Venice-synthesized intelligence + engagement network graphs to inform awareness-building and (future) reciprocation.

## 2. Principles

- **Privacy by construction.** All data stays in the user's browser (IndexedDB via Zustand persist). No server, no retention. The only outbound calls are X reads (user's bearer, via MCP) and Venice synthesis (user's Venice key, existing pattern). No third-party transmission, no telemetry.
- **Account-agnostic.** No "my account" concept. The user inputs arbitrary target usernames; each becomes a persisted intel report. Erik + Venice team are the first targets, not special cases.
- **Modular (bolt on/off).** Each `x-intel/*` unit is independent: gather, store, reason, ui, (future) post. Remove one and the others still work.
- **Upstream-clean.** The whole module lives under `src/components/x-intel/`, `src/stores/x-intel-*`, `src/lib/x-intel/`. PRing the tab upstream to `nikshepsvn/openvenice` means one folder + a few registry entries in `app.tsx` / `settings-store.ts`. aispace.bot-specific branding stays on the `v3` branch; `master` tracks upstream and stays PR-friendly.
- **Reading over posting.** The gather → store → present → decide pipeline is 90% of the tool. Posting is the thin trailing edge, deferred entirely from v1.
- **Cost-aware.** X API is pay-per-use (credit-based, per resource). Every fetch has a visible cost; `since_id` incremental fetching is mandatory for refreshes; edges are derived locally for free; engager fetches are lazy and capped.

## 3. v1 Architecture

```
┌──────────────────────────────────────────────────────────┐
│  OpenVenice SPA  (Vite, React 19, Zustand, all in browser)│
│  chat | image | audio | music | video | embed | workflow │
│                                                          │
│  + NEW  Intel tab                                        │
│         │                                                │
│         ├─ Credentials dialog  (mirrors Venice key UI)   │
│         │   Bearer token for reads (pay-per-use)         │
│         │   "Stored locally, never sent to third parties"│
│         │                                                │
│         ├─ Targets  (user-entered, account-agnostic)     │
│         │   e.g. ErikVoorhees, venice_ai, …              │
│         │   each target → one persisted intel report     │
│         │                                                │
│         ├─ Gather  ──→ X MCP / X API (user's bearer)     │
│         │   fields.ts: USER_FIELDS, POST_FIELDS, …       │
│         │   normalized entities (Profile, Post, Edge)    │
│         │                                                │
│         ├─ Store  (IndexedDB, Zustand persist)           │
│         │   reports: { target → profile, posts, edges,   │
│         │             synthesis, activity, drafts }      │
│         │   settings, cost meter — your browser only     │
│         │                                                │
│         ├─ Reason  ──→ api.venice.ai (existing key)      │
│         │   character synthesis · theme extraction       │
│         │                                                │
│         └─ UI: target switcher · profile card ·          │
│             network graph · activity feed · composer     │
└──────────────────────────────────────────────────────────┘
```

**Evolution path (not in v1 scope, documented for continuity):**
- **Phase 2 (scheduled):** Vercel Cron hits a stateless function on a schedule; drafts queue in a tiny cloud KV. Still no long-running process.
- **Phase 3 (autonomous 24/7 worker):** Promote the function + queue into a long-running Railway worker. GUI becomes a control panel. Same X service module throughout — Phase 1 → 3 is configuration, not rewrites.

### Unit boundaries

| Unit | Path | What it does | Depends on |
|---|---|---|---|
| `credentials` | `src/components/x-intel/credentials-dialog.tsx` + `src/stores/x-intel-auth-store.ts` | Modal mirroring Venice key dialog; stores X bearer in persisted Zustand store | Zustand persist |
| `targets` | `src/components/x-intel/target-rail.tsx` + `src/stores/x-intel-store.ts` | User adds/removes target usernames; each gets a report namespace | `store` |
| `gather` | `src/lib/x-intel/gather.ts` + `fields.ts` | Calls X MCP with stored bearer + field config; normalizes to entities | credentials, fields |
| `store` | `src/stores/x-intel-store.ts` (persisted) | IndexedDB; one report per target (profile, posts, edges, synthesis, drafts); cost meter | Zustand persist |
| `reason` | `src/lib/x-intel/synthesize.ts` | Venice synthesis calls (character profile, theme extraction, draft enhancement) | existing `venice-client.ts` |
| `ui/*` | `src/components/x-intel/*` | Target switcher, profile card, network graph, activity feed, composer | all of the above |

**Out of scope for v1 (YAGNI):**
- No posting backend, no scheduling, no autonomous worker, no `x-intel/post` unit at all
- No multi-account, no multi-target merged views (each target's report is independent)
- No real-time streaming (poll on demand / on refresh)
- No server-side analytics or aggregation
- No follower-network crawling (graph is engagement network, not follower network)

## 4. Tab Structure

Three navigation levels, all matching OpenVenice's existing conventions:

| Level | Mechanism | Reuses |
|---|---|---|
| 1. Main tab | Sidebar entry `intel`, slot 8, shortcut ⌘8 | `Sidebar` component, `views`/`TAB_ORDER` in `app.tsx` |
| 2. In-tab view | Pill sub-tabs: Profile / Network / Feed / Draft | Same pill toggle style as `image-page.tsx` |
| 3. Target | Left rail inside the tab; one intel report per selected target | New, styled like chat history list in `Sidebar` |

### Sub-tabs

| Sub-tab | Purpose | Primary content |
|---|---|---|
| **Profile** | Dynamic character profile | Avatar, metrics, verification badge, bio; Venice-synthesized character summary (themes, register, recurring topics, posting cadence, flagship post); refresh/regenerate controls |
| **Network** | Visually represented network graph | React Flow canvas (reuses `@xyflow/react`); nodes = engaged accounts; edges = relationship type + frequency; click node → add as new target |
| **Feed** | Tracked post activity | Chronological gathered posts; engagement metrics; filter by type (original/quote/reply); "watch" toggle per target (refresh on tab open) |
| **Draft** | Reciprocation workspace | Venice-generated draft replies/posts based on active target's recent content + user instructions; editable; copy-to-clipboard; **no posting in v1** |

### Target switcher (left rail) behavior

- `+ Add target` → inline username input; on submit, gather runs, report created in IndexedDB, new target selected
- Each row: avatar + name + freshness indicator (last-gathered relative time)
- Hover row: delete (removes report + target), re-gather, pin
- Selecting a target loads its report into the active sub-tab (switching targets keeps you in the same view)
- Empty state: "Add a target to start gathering intel" with ErikVoorhees / venice_ai grayed as suggestions

### Header credential button

- Reuses existing Header right-slot pattern, for X instead of Venice
- Shows `Bearer: Connected` (green dot) or `X Key` (dim dot), same styling as the Venice API Key button
- Click → opens X credentials dialog (modal mirroring `api-key-dialog.tsx`)
- Dialog subtext: "Pay-per-use — credits deducted per request. Stored locally, never sent to third parties."

## 5. Gather Layer + Fields Config

### Fields config (single source of truth)

```ts
// src/lib/x-intel/fields.ts
export const USER_FIELDS = [
  'id', 'name', 'username', 'verified', 'verified_type',
  'description', 'location', 'url', 'profile_image_url',
  'pinned_tweet_id', 'most_recent_tweet_id',
  'public_metrics', 'entities', 'created_at',
] as const

export const POST_FIELDS = [
  'id', 'text', 'lang', 'created_at', 'edit_history_post_ids',
  'public_metrics', 'context_annotations', 'entities',
  'referenced_tweets', 'reply_settings', 'source',
  'possibly_sensitive', 'attachments',
] as const

export const POST_EXPANSIONS = [
  'author_id', 'attachments.media_keys', 'referenced_tweets.id',
] as const

export const USER_EXPANSIONS = ['pinned_tweet_id'] as const
```

**Lesson baked in:** `verified_type` sits next to `verified` in `USER_FIELDS` and can never drift apart (this was a real miss during research — the API returned `verified: false` without `verified_type`, which would have rendered Erik as unverified despite his blue check).

### Normalized entities

```ts
// src/lib/x-intel/types.ts
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
  target: string   // engaged user id
  targetUsername: string
  kind: 'quote' | 'reply' | 'mention' | 'retweet'
  weight: number   // occurrence count across gathered posts
  lastSeen: string
}
```

`Post.kind` is derived from `referenced_tweets` (API gives `type: 'replied_to' | 'quoted' | 'retweeted_to'`). `Edge` is derived by scanning gathered posts for mentions/quotes/replies and counting — **no separate fetch**.

### Gather operations (cost-aware)

X API is pay-per-use as of Feb 2026. Credits bought upfront, deducted per resource returned.

| Operation | MCP tool | Cost | Trigger | Strategy |
|---|---|---|---|---|
| `gatherProfile(username)` | `get_users_by_username` | $0.01 | Add target, manual refresh | Always; cheap |
| `gatherPosts(targetId, sinceId)` | `get_users_posts` | $0.005 × count | Add target (backfill ~50), refresh (incremental via `since_id`) | `since_id` mandatory for refresh; backfill default 50, user-tunable |
| `gatherMentions(targetId)` | `get_users_mentions` | $0.005 × count | Manual; optional watch | Same incremental pattern |
| `searchTargetTopic(query)` | `search_posts_all` | $0.005 × count | On-demand from Feed | User-initiated only |
| `gatherEngagers(postId)` | `get_posts_liking_users` etc. | $0.001 × likes | Lazy, expand post in Feed | **Hard cap 100 likers, explicit action only** |
| `deriveEdges(posts)` | local | $0 | automatic | Scans already-paid-for posts; no API call |

### Cost meter

A small, always-visible indicator (target rail footer or header) showing credits spent this session and per-target, with a settings option for a soft budget warning. Tracked client-side in IndexedDB, never sent anywhere. Estimates use the read-operations rate card: Posts $0.005, Users $0.010, Likes $0.001.

### Incremental gathering (cost workhorse)

- Each report stores `mostRecentPostId` from the last gather
- On refresh, `gatherPosts` passes `since_id: mostRecentPostId` — X returns only posts newer than that
- New posts are **merged** into existing `Post[]`, deduped by `id`
- `Profile` is always overwritten (cheap, metrics change)
- `Edge[]` is recomputed from the full merged `Post[]` — no incremental edge math, just re-derive. Cheap and correct.

### Credential model

**Pay-per-use only.** No Basic/Pro stacking (docs confirm you either run an app on Basic *or* opt it into pay-per-use — not both on one credential set). Single bearer token, stored locally, single cost model. Dialog subtext states "Pay-per-use — credits deducted per request."

**Transport:** reads call the X API v2 directly from the browser using the user's stored bearer, through a Vite proxy (`/xapi` → `https://api.x.com`) — the exact pattern OpenVenice already uses for Venice (`/venice` → `https://api.venice.ai` in `vite.config.ts`). This keeps the app fully account-agnostic and self-contained (the X MCP server was a research tool during design, not an app dependency).

## 6. Profile Synthesis

### Synthesis config (user-adjustable, with defaults)

These are user-controllable variables exposed in the Profile sub-tab controls (gear popover), not hardcoded constants. Defaults are chosen for analytical consistency:

- **Context cap:** default 80 posts (most recent) — user can adjust 10–200. Balances signal vs. Venice token cost; lower = cheaper + faster, higher = more context.
- **Temperature:** default 0.3 — user can adjust 0.0–1.0. Low temp gives analytical consistency (regenerating yields a recognizably similar profile); higher temp gives more varied phrasing.
- **Default model:** `venice-uncensored-1-2` (cheap, capable, always available); user can pick any chat model OpenVenice already lists via the existing `use-models` hook.
- **Streaming:** non-streaming (fixed implementation choice, not a user variable — synthesis returns a complete structured result, not token-by-token; simpler, fits the "report" mental model).

Settings persist per-target in the report (different targets may warrant different caps/temps) and globally as defaults for new targets.

### Synthesis flow

`x-intel/reason` reuses `venice()` from `src/lib/venice-client.ts` directly:

```ts
// src/lib/x-intel/synthesize.ts
import { venice } from '../venice-client'

const SYNTHESIS_SYSTEM = `You are an intelligence analyst. Given a target's
recent posts and profile, produce a structured character profile:
themes, register, recurring topics, posting cadence, flagship post.
Be specific and evidence-grounded. Cite post content. No fluff.`

export interface SynthesisSettings {
  contextCap: number    // default 80, user-adjustable 10–200
  temperature: number   // default 0.3, user-adjustable 0.0–1.0
  model: string         // default 'venice-uncensored-1-2'
}

export async function synthesizeProfile(
  profile: Profile,
  posts: Post[],
  settings: SynthesisSettings,
): Promise<CharacterProfile> {
  const transcript = posts
    .slice(0, settings.contextCap)
    .map(p => `[${p.createdAt}] (${p.kind}, ${p.metrics.likes}L/${p.metrics.reposts}R) ${p.text}`)
    .join('\n')

  const resp = await venice<ChatCompletionResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: settings.model,
      stream: false,                                  // non-streaming is a fixed implementation choice
      temperature: settings.temperature,
      messages: [
        { role: 'system', content: SYNTHESIS_SYSTEM },
        { role: 'user', content: `Profile: ${JSON.stringify(profile)}\n\nPosts:\n${transcript}` },
      ],
    }),
  })

  return parseSynthesis(resp.choices[0].message.content)  // structured parse → CharacterProfile
}
```

**Types referenced above** (defined in `src/lib/x-intel/types.ts` during implementation):

```ts
export interface CharacterProfile {
  themes: string[]
  register: string
  recurringTopics: { topic: string; postCount: number; lastSeen: string }[]
  postingCadence: { pattern: 'burst' | 'steady'; peakWindowsUtc: string[]; avgPerDay: number; variance: 'high' | 'medium' | 'low' }
  flagshipPost: { postId: string; excerpt: string; metrics: Post['metrics'] }
  synthesizedAt: string  // ISO
  model: string          // which Venice model produced this
}
```

- `parseSynthesis(content: string): CharacterProfile` — parses the LLM's markdown/structured-text response into the typed `CharacterProfile`. Implementation detail; the system prompt instructs the model to emit a consistent structure (themes as bullet list, cadence as labeled fields, etc.) and `parseSynthesis` extracts them defensively.
- `ChatCompletionResponse` — the existing OpenVenice type for `/chat/completions` non-streaming responses (already defined in `src/types/venice.ts`, reused as-is).

### Profile sub-tab layout

- **Header strip:** avatar, display name, verification badge (with type: blue/business/government), `@username`, location, join date, follower count, bio, refresh button, last-gathered relative time
- **Metrics row:** posts, following, likes, listed counts
- **Synthesized character profile** (Venice-generated, persisted):
  - **Themes** — top recurring themes (e.g. crypto/AI convergence, anti-surveillance, open-source advocacy)
  - **Register** — tone/style description (e.g. sardonic, declarative, economic-literacy-forward)
  - **Recurring topics (last 30 days)** — specific topic clusters with post-count weights
  - **Posting cadence** — burst vs. steady, peak windows, avg posts/day, variance
  - **Flagship recent post** — highest-engagement post with metrics; click → jumps to that post in Feed
- **Controls:** Regenerate profile button, model selector (defaults to `venice-uncensored-1-2`), gear popover with synthesis settings (context cap slider 10–200, temperature slider 0.0–1.0). Settings persist per-target and as global defaults for new targets.

### Design decisions

- **`CharacterProfile` is persisted.** Synthesis runs on demand (add target, manual regenerate) and the result is stored in IndexedDB with the report. Switching targets loads the cached profile instantly; re-synthesize only when you refresh gather + regenerate.
- **Evidence-grounded by design.** System prompt demands cited post content. Flagship post links back to a real post ID in the store.
- **What synthesis does NOT do:** no speculation beyond gathered data, no opinions about the person, no drafts (that's the Draft sub-tab's job, with different prompting). It's a structured distillation of what's actually there.

## 7. Network Graph

### What it shows

A React Flow canvas (reuses `@xyflow/react` v12, already a dependency for the Workflows tab) rendering `Edge[]` from the store as nodes + edges. **No new dependency** — zero bundle weight added, identical look/feel to the Workflows tab.

### Node encoding

- **Target node** — larger, centered by default, distinct color (white fill, matching OpenVenice's active-tab accent)
- **Engaged accounts** — sized by edge weight (more interactions = bigger), colored by relationship type (quotes = one hue, replies = another, mentions = another)
- **Label** = `@username`; hover = tooltip with edge count + last seen; click = "Add as target" action (creates a new intel report, gathering begins)
- **Unresolved nodes** — edges reference user IDs we haven't fetched profiles for. Show as `@unknown (id: …)` until you click "resolve" (one $0.01 User:Read call each, opt-in)

### Edge encoding

- Thickness = weight (occurrence count across gathered posts)
- Label on hover = `quote × 3, mention × 1, last seen 2d ago`
- Directional where it matters (quote → quoted author; reply → replied-to author)

### Layout

- Default: force-directed (React Flow built-in), target node pinned center, others arrange by edge tension
- User can drag nodes, zoom/pan (React Flow default — same as Workflows tab)
- Toolbar: `Relayout` · `Filter by type` (quotes/replies/mentions/retweets) · `Only show weight ≥ N` · `Resolve all unknown nodes` (with cost estimate: "Resolving 7 nodes ≈ $0.07")

### Data flow (no extra fetches for base graph)

```
gather posts ($0.005 × N)
    ↓
deriveEdges(posts) — local, free, scans mentions/quotes/replies
    ↓
Edge[] stored in report
    ↓
Network sub-tab renders Edge[] as React Flow graph
    ↓
click node → "Add as target" → new gather cycle begins (new report)
```

The graph is a **view over data you already paid for**. The only new API costs are opt-in: resolving unknown nodes ($0.01 each) or adding a node as a new target (gather cost for that target).

### Out of scope for v1 Network

- No real-time graph updates (graph re-renders from store on gather/refresh, not streaming)
- No follower-network crawling (fetching all of Erik's 4,499 following = $45 + huge graph — explicitly out; graph is *engagement* network, not *follower* network)
- No cross-target graph merging in v1 (each target's graph is its own report; merged view is a future feature)

## 8. Privacy Posture

- **X bearer token:** localStorage, user's browser, clearable, never sent anywhere except directly to X's API for reads
- **Venice key:** unchanged from OpenVenice's existing behavior (localStorage, existing `auth-store.ts`)
- **Intel reports:** IndexedDB, user's browser, clearable per-target or all-at-once
- **Server:** none in v1. The future posting function (separate spec) will be stateless and retain nothing
- **Cost meter data:** client-side only, never transmitted

## 9. X API Context (for future posting spec)

Documented here so the future posting spec inherits the context:

- **Pay-per-use launched Feb 6, 2026.** Credit-based, per-resource. Reads: Posts $0.005, Users $0.010, Likes $0.001. Writes: `POST /2/tweets` $0.015, URL posts $0.20, summoned replies $0.01.
- **Anti-LLM-spam rules (Feb 2026):** Programmatic replies via `POST /2/tweets` are only permitted when the original author has "summoned" the replier (mentioned them or quoted their post). This *reinforces* the "Erik mentioned you → draft a reciprocation" workflow as the legitimate automation pattern for the future posting layer.
- **Following/Likes/Quote-posts via API removed from self-serve tiers** (April 2026). The future posting layer can post and reply (when summoned) but cannot follow/like/quote-post programmatically.
- **X API Playground** (`go install github.com/xdevplatform/playground@latest`) — self-hosted mock X API v2 server for development without real costs. Worth using during implementation to develop gather against mock data, then validate against real API.
- **XDK (TypeScript)** (`npm install @xdevplatform/xdk`) — official first-party SDK with auth, pagination, streaming. Worth evaluating for the future posting layer; v1 reads go through the MCP.

## 10. Open questions (none blocking v1)

- OAuth 1.0a vs 2.0 for the future posting layer (deferred to posting spec)
- Cloud KV choice for Phase 2 scheduling queue (deferred to Phase 2 spec)
- Whether to evaluate the XDK TypeScript SDK for v1 reads (MCP currently suffices; revisit if MCP toolset gaps emerge during implementation)

## 11. File structure (to be created during implementation)

```
src/
├── app.tsx                              # +intel to views, TAB_ORDER
├── stores/
│   ├── settings-store.ts                # +'intel' to Tab type
│   ├── x-intel-auth-store.ts            # NEW — X bearer, persisted
│   └── x-intel-store.ts                 # NEW — reports, targets, cost meter, persisted
├── lib/
│   └── x-intel/
│       ├── fields.ts                    # USER_FIELDS, POST_FIELDS, expansions
│       ├── types.ts                     # Profile, Post, Edge, CharacterProfile, ChatCompletionResponse (reused)
│       ├── gather.ts                    # gatherProfile, gatherPosts, gatherMentions, search, gatherEngagers
│       ├── normalize.ts                 # normalizeProfile, normalizePost, deriveEdges
│       └── synthesize.ts                # synthesizeProfile (Venice)
└── components/
    └── x-intel/
        ├── intel-view.tsx               # main tab view, sub-tab pills, target rail
        ├── credentials-dialog.tsx       # X bearer modal (mirrors api-key-dialog.tsx)
        ├── target-rail.tsx              # left rail: add target, list, select, delete, re-gather
        ├── profile-card.tsx             # Profile sub-tab
        ├── network-graph.tsx            # Network sub-tab (React Flow)
        ├── activity-feed.tsx            # Feed sub-tab
        ├── draft-workspace.tsx          # Draft sub-tab
        └── cost-meter.tsx               # session + per-target cost indicator
```

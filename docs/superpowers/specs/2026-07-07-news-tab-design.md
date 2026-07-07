# News Tab — Design

_Date: 2026-07-07_

## Purpose

Add a **News** tab to OVX: a general-purpose news reader driven by curated RSS
feeds. It presents breaking headlines in a quick, scannable feed with expandable
rows, source hyperlinks, per-category filtering, per-source toggles, keyword
search, bookmarks, and an on-demand Venice-powered TL;DR.

This is distinct from the existing **Signal** tab: Signal tracks Venice-specific
community buzz (tweets/articles/videos from VeniceStats); News covers general
industry and world headlines from mainstream publishers. Default-enabled
categories are AI, Crypto, and Tech; Business, World, and Science ship disabled
but can be switched on.

## Success Criteria

1. A News tab appears in the sidebar's Dashboard group (after Stats) and renders
   a feed of current headlines from the enabled RSS sources.
2. A left category rail filters the feed (All + AI, Crypto, Tech, Business,
   World, Science) and shows item counts; a collapsible Sources section provides
   per-feed checkboxes; a Bookmarks entry shows saved articles.
3. A "Latest" strip at the top shows the 4–5 newest items across all enabled
   feeds regardless of the active category filter.
4. Rows are collapsed by default (thumbnail, source badge, 2-line title,
   relative time) and expand inline on click to show the full summary, larger
   image, "Read full article ↗" link, TL;DR button, and bookmark toggle. One
   row is expanded at a time.
5. TL;DR: scrapes the article via the Venice web-scrape API, summarizes with a
   fast Venice chat model into 2–3 bullets, rendered inside the expanded row.
   If scrape fails, it summarizes the RSS excerpt and labels the result
   "based on excerpt". Results are cached in-memory per URL.
6. Keyword search filters the visible feed client-side.
7. Enabled sources, active category, and bookmarks persist across reloads.
8. The feed auto-refreshes every 3 minutes; header shows "Updated Xm ago".
9. Partial feed failures degrade gracefully (notice, not error page); total
   failure shows a retry state matching SignalView's pattern.

## Architecture

### Server layer — `api/news/proxy.ts`

New Vercel serverless function mirroring `api/venicestats/proxy.ts`:

- `GET /api/news/proxy?feeds=<id1>,<id2>,...` — accepts **feed IDs only**
  (never raw URLs) so the endpoint cannot be used as an open relay.
- Feed registry lives in one shared module, `src/lib/news/feeds.ts`, imported
  by both the serverless function and the client (client uses names/categories
  for the UI; server uses URLs): ~15–20 curated RSS/Atom feeds, each
  `{ id, name, url, category }`. Candidate list (verified
  during implementation; unreachable/malformed feeds dropped or replaced):
  - **AI**: TechCrunch AI, The Verge AI, VentureBeat AI, Ars Technica AI
  - **Crypto**: CoinDesk, Cointelegraph, The Block, Decrypt
  - **Tech**: The Verge, Ars Technica, TechCrunch, Hacker News frontpage
  - **Business**: Reuters Business, CNBC Business
  - **World**: BBC World, Reuters World, Al Jazeera
  - **Science**: Nature News, ScienceDaily, Ars Technica Science
- Fetches requested feeds concurrently, per-feed timeout ~8s, UA header set
  (some publishers reject default fetch UAs).
- Parses RSS 2.0 **and** Atom with `fast-xml-parser` (small, zero-dep, added to
  `dependencies`).
- Normalizes into `NewsItem[]`; strips HTML from summaries and truncates to a
  sane length server-side; extracts `imageUrl` from `media:content`,
  `enclosure`, `media:thumbnail`, or the first `<img>` in the description.
- Response shape: `{ items: NewsItem[], failures: Array<{ feedId, error }> }`.
  Individual feed failures never fail the whole response.
- `cache-control: s-maxage=180, stale-while-revalidate=60` so Vercel's edge
  absorbs repeat traffic.
- Dev flow: runs under `vercel dev` with `VITE_API_TARGET` (the existing
  catch-all `/api` Vite proxy rule) — same as the X OAuth endpoints. Without
  `VITE_API_TARGET` the endpoint 404s in dev, matching current behavior for
  other serverless routes.

### Shared types — `src/lib/news/types.ts`

```ts
type NewsCategory = 'ai' | 'crypto' | 'tech' | 'business' | 'world' | 'science'

interface NewsFeed { id: string; name: string; url: string; category: NewsCategory }

interface NewsItem {
  id: string          // stable hash of url
  feedId: string
  category: NewsCategory
  sourceName: string
  title: string
  summary: string     // HTML-stripped, truncated
  url: string
  imageUrl?: string
  publishedAt: string // ISO; may be empty if feed omits pubDate
}

interface NewsResponse { items: NewsItem[]; failures: Array<{ feedId: string; error: string }> }
```

### Client data layer

- `src/lib/news/client.ts` — `fetchNews(feedIds: string[]): Promise<NewsResponse>`
  following `venicestats/client.ts` conventions, incl. a `NewsError` class.
- `src/hooks/use-news.ts` — TanStack Query:
  `queryKey: ['news', sortedFeedIds]`, `staleTime` and `refetchInterval` of
  3 minutes.
- `src/stores/news-store.ts` — zustand + `persist` + `createSafeStorage`
  (same pattern as `settings-store`):
  - `enabledFeedIds: string[]` — default: all feeds in AI, Crypto, Tech.
  - `activeCategory: 'all' | NewsCategory | 'bookmarks'`
  - `bookmarks: NewsItem[]` (full items persisted so they survive feed
    disabling), `toggleBookmark(item)`.
  - Search query is local component state, not persisted.

### Tab wiring

Standard three-place wiring:

1. `settings-store.ts` — add `'news'` to the `Tab` union.
2. `app.tsx` — lazy `NewsView` (same `lazy` + `Suspense` pattern as Signal).
3. `sidebar.tsx` — `{ id: 'news', label: 'News', Icon: NewsIcon }` in the
   Dashboard group after Stats; newspaper-style stroke icon matching the
   existing 16px/1.6-stroke icon set.

### UI components — `src/components/news/`

| File | Responsibility |
|---|---|
| `news-view.tsx` | Page shell: header ("News · Updated Xm ago"), Latest strip, two-column body (category rail ~180px + feed). Rail collapses to horizontal chips on mobile (`md:` breakpoint). Handles loading/error/empty top-level states like SignalView. |
| `category-rail.tsx` | "All" + six categories with item counts; "Bookmarks" entry; collapsible **Sources** section with per-feed checkboxes bound to `enabledFeedIds`. |
| `latest-strip.tsx` | Horizontal row of the 4–5 newest items across all enabled feeds (compact cards: source, clamped title, relative time). Independent of the category filter. |
| `news-feed.tsx` | Search input + article list. Newest-first; filters by category + search (title/summary/source match). Dismissible notice when `failures` is non-empty ("N sources unreachable: …"). Empty states for no-match / no-feeds-enabled. |
| `news-row.tsx` | Collapsed: thumbnail (if any), source badge, 2-line clamped title, relative time, NEW-ish recency handled purely by sort. Expanded (one at a time, controlled by parent): full summary, larger image, "Read full article ↗" (`target="_blank" rel="noopener noreferrer"`), TL;DR button, bookmark toggle. |
| `tldr.tsx` | TL;DR button + result panel. Flow: Venice web-scrape on the article URL → Venice chat (small fast model) → 2–3 bullets. Loading shimmer while running; scrape failure falls back to summarizing the RSS excerpt with a "based on excerpt" caption. Module-level in-memory cache keyed by URL. Uses the existing Venice client/BYOK plumbing (`/venice` proxy). |

Styling uses existing design tokens (`--color-bg-raised`, `--color-border-soft`,
`--color-accent`, `LoadingState`, etc.) so News is visually native next to
Signal/Stats. Feed list container reuses the BuzzFeed card treatment
(rounded-xl border, divide-y rows, hover accent wash).

## Error Handling & Edge Cases

- **All feeds fail / offline** → centered error + Retry (SignalView pattern).
- **Some feeds fail** → feed renders; dismissible notice lists failed sources.
- **No search/category matches** → "No matching articles" empty state.
- **Zero feeds enabled** → prompt pointing to the Sources panel.
- **Duplicates** → dedupe by URL server-side.
- **Missing pubDate** → item sorts last; missing image → text-only row.
- **Bookmarks** → remain viewable under Bookmarks even if their source feed is
  later disabled or the item ages out of the feed.
- **TL;DR failures** → scrape failure falls back to excerpt summarization;
  chat failure shows an inline error with retry, never breaks the row.

## Testing

Automated (vitest, following the existing `src/**/*.test.ts` convention):
RSS/Atom normalization logic (parse fixtures → `NewsItem[]`), summary HTML
stripping/truncation, image extraction, dedupe/sort, and news-store behavior
(enable/disable feeds, bookmarks toggle, persistence shape).

Manual verification:

1. Run `vercel dev` + Vite with `VITE_API_TARGET`; confirm every registry feed
   parses (or gets culled from the registry).
2. Category filtering, source checkboxes, and counts behave correctly.
3. Search filters live; bookmarks persist across reload; enabled sources and
   active category persist across reload.
4. TL;DR happy path and scrape-failure fallback.
5. Partial-failure notice (temporarily point a registry entry at a dead URL).
6. Mobile layout (rail → chips), expanded-row behavior, external links open in
   new tabs.

## Out of Scope (future ideas)

- Push/desktop notifications for breaking news.
- Per-article Venice chat ("discuss this article").
- Custom user-added RSS URLs (requires open-relay hardening on the proxy).
- Full-text reader view.
- Cross-device sync of bookmarks.

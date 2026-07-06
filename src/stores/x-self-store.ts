// Store for the OAuth-connected user's OWN X data (the "Profile" tab). Kept
// separate from the target-oriented x-intel-store: this is a single subject
// (you), sourced from the user-context OAuth session rather than the app-only
// bearer token, and carries OAuth-only extras (bookmarks, likes).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Post, Edge, IntelReportSnapshot, SynthesisSettings } from '../lib/x-intel/types'
import { DEFAULT_SYNTHESIS_SETTINGS } from '../lib/x-intel/types'

export interface SelfSectionsRefreshed {
  profile?: string
  posts?: string
  bookmarks?: string
  likes?: string
}

interface XSelfState {
  connected: boolean
  // True while the OAuth round-trip is in flight (click → x.com → return) or
  // while the post-redirect session probe is still resolving. Not persisted:
  // re-derived on load from the URL params + sessionStorage bridge.
  connecting: boolean
  profile: Profile | null
  posts: Post[]
  bookmarks: Post[]
  likes: Post[]
  edges: Edge[]
  reportHistory: IntelReportSnapshot[]
  activeReportId: string | null
  refreshedAt: SelfSectionsRefreshed
  synthesisSettings: SynthesisSettings

  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setProfile: (profile: Profile | null) => void
  setPosts: (posts: Post[]) => void
  setBookmarks: (bookmarks: Post[]) => void
  setLikes: (likes: Post[]) => void
  setEdges: (edges: Edge[]) => void
  markRefreshed: (section: keyof SelfSectionsRefreshed) => void
  setSynthesisSettings: (patch: Partial<SynthesisSettings>) => void
  appendReport: (snapshot: IntelReportSnapshot) => void
  setActiveReport: (id: string) => void
  deleteReport: (id: string) => void
  /** Drop the live connection flags but keep all cached profile/posts/reports so
   *  a reconnect is instant and the UI doesn't flash "no reports" while the
   *  persist layer re-hydrates. Use `reset()` only for a hard wipe. */
  disconnect: () => void
  /** Hard-clear everything (cached data + flags). Not used by the disconnect UI. */
  reset: () => void
}

const EMPTY = {
  profile: null,
  posts: [] as Post[],
  bookmarks: [] as Post[],
  likes: [] as Post[],
  edges: [] as Edge[],
  reportHistory: [] as IntelReportSnapshot[],
  activeReportId: null as string | null,
  refreshedAt: {} as SelfSectionsRefreshed,
  synthesisSettings: DEFAULT_SYNTHESIS_SETTINGS,
}

export const useXSelfStore = create<XSelfState>()(
  persist(
    (set) => ({
      connected: false,
      connecting: false,
      ...EMPTY,

      setConnected: (connected) => set({ connected }),
      setConnecting: (connecting) => set({ connecting }),
      setProfile: (profile) => set({ profile }),
      setPosts: (posts) => set({ posts }),
      setBookmarks: (bookmarks) => set({ bookmarks }),
      setLikes: (likes) => set({ likes }),
      setEdges: (edges) => set({ edges }),
      markRefreshed: (section) =>
        set((s) => ({ refreshedAt: { ...s.refreshedAt, [section]: new Date().toISOString() } })),

      setSynthesisSettings: (patch) =>
        set((s) => ({ synthesisSettings: { ...s.synthesisSettings, ...patch } })),

      appendReport: (snapshot) =>
        set((s) => ({ reportHistory: [snapshot, ...s.reportHistory], activeReportId: snapshot.id })),
      setActiveReport: (id) =>
        set((s) => (s.reportHistory.some((r) => r.id === id) ? { activeReportId: id } : s)),
      deleteReport: (id) =>
        set((s) => {
          const reportHistory = s.reportHistory.filter((r) => r.id !== id)
          const activeReportId = s.activeReportId === id ? (reportHistory[0]?.id ?? null) : s.activeReportId
          return { reportHistory, activeReportId }
        }),

      // Soft-disconnect: drop the live connection flags but keep all cached
      // profile/posts/bookmarks/likes/reports so a reconnect is instant and the
      // UI doesn't flash empty states while the persist layer re-hydrates. The
      // server-side logout call is the caller's responsibility (selfLogout()).
      disconnect: () => set({ connected: false, connecting: false }),

      // Hard-clear everything (flags + cached data). Not used by the disconnect UI.
      reset: () => set({ connected: false, connecting: false, ...EMPTY }),
    }),
    {
      name: 'x-self-profile',
      // Persist everything except the live `connected` flag, which is
      // re-derived from the server session on load.
      partialize: (s) => ({
        profile: s.profile,
        posts: s.posts,
        bookmarks: s.bookmarks,
        likes: s.likes,
        edges: s.edges,
        reportHistory: s.reportHistory,
        activeReportId: s.activeReportId,
        refreshedAt: s.refreshedAt,
        synthesisSettings: s.synthesisSettings,
      }),
    },
  ),
)

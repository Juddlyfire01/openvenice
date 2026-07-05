// Store for the OAuth-connected user's OWN X data (the "Profile" tab). Kept
// separate from the target-oriented x-intel-store: this is a single subject
// (you), sourced from the user-context OAuth session rather than the app-only
// bearer token, and carries OAuth-only extras (bookmarks, likes).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Post, Edge, IntelReportSnapshot } from '../lib/x-intel/types'

export interface SelfSectionsRefreshed {
  profile?: string
  posts?: string
  bookmarks?: string
  likes?: string
}

interface XSelfState {
  connected: boolean
  profile: Profile | null
  posts: Post[]
  bookmarks: Post[]
  likes: Post[]
  edges: Edge[]
  reportHistory: IntelReportSnapshot[]
  activeReportId: string | null
  refreshedAt: SelfSectionsRefreshed

  setConnected: (connected: boolean) => void
  setProfile: (profile: Profile | null) => void
  setPosts: (posts: Post[]) => void
  setBookmarks: (bookmarks: Post[]) => void
  setLikes: (likes: Post[]) => void
  setEdges: (edges: Edge[]) => void
  markRefreshed: (section: keyof SelfSectionsRefreshed) => void
  appendReport: (snapshot: IntelReportSnapshot) => void
  setActiveReport: (id: string) => void
  deleteReport: (id: string) => void
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
}

export const useXSelfStore = create<XSelfState>()(
  persist(
    (set) => ({
      connected: false,
      ...EMPTY,

      setConnected: (connected) => set({ connected }),
      setProfile: (profile) => set({ profile }),
      setPosts: (posts) => set({ posts }),
      setBookmarks: (bookmarks) => set({ bookmarks }),
      setLikes: (likes) => set({ likes }),
      setEdges: (edges) => set({ edges }),
      markRefreshed: (section) =>
        set((s) => ({ refreshedAt: { ...s.refreshedAt, [section]: new Date().toISOString() } })),

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

      // On disconnect, drop the connection flag but keep cached data so a
      // reconnect is instant; reset() is available for a hard clear.
      reset: () => set({ connected: false, ...EMPTY }),
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
      }),
    },
  ),
)

// Store for the OAuth-connected user's OWN X data (the "Profile" tab). Kept
// separate from the target-oriented x-intel-store: this is sourced from the
// user-context OAuth session rather than the app-only bearer token, and carries
// OAuth-only extras (bookmarks, likes).
//
// Multi-account model: each connected X account (its own OAuth grant) has its
// own SelfAccount entry keyed by X user id. `activeAccountId` selects which one
// the UI shows; switching it triggers a server-side cookie change so subsequent
// /api/x/proxy calls hit that account. Mirrors how useXIntelStore already
// stores per-target reports.
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

/** One connected X account's cached data. */
export interface SelfAccount {
  id: string
  username: string
  profile: Profile | null
  posts: Post[]
  bookmarks: Post[]
  likes: Post[]
  edges: Edge[]
  reportHistory: IntelReportSnapshot[]
  activeReportId: string | null
  refreshedAt: SelfSectionsRefreshed
  synthesisSettings: SynthesisSettings
}

function emptyAccount(id: string, username: string, synthesisSettings: SynthesisSettings): SelfAccount {
  return {
    id,
    username,
    profile: null,
    posts: [],
    bookmarks: [],
    likes: [],
    edges: [],
    reportHistory: [],
    activeReportId: null,
    refreshedAt: {},
    synthesisSettings,
  }
}

interface XSelfState {
  /** Per-account cache keyed by X user id. */
  accounts: Record<string, SelfAccount>
  /** Display order for the rail (X user ids). */
  accountOrder: string[]
  /** The currently-selected account; matches the server-side x_active_account. */
  activeAccountId: string | null
  /** True while the OAuth round-trip is in flight. Not persisted. */
  connecting: boolean
  /** True when at least one account has a live server session. Not persisted —
   *  re-derived from the session probe by reconcileAccounts(). Kept for the
   *  many components that gate on `connected` (header, rails, refresh buttons). */
  connected: boolean
  defaultSynthesisSettings: SynthesisSettings

  // Account lifecycle
  upsertAccount: (account: { id: string; username: string }) => void
  removeAccount: (id: string) => void
  setActiveAccount: (id: string | null) => void
  setConnecting: (connecting: boolean) => void
  setConnected: (connected: boolean) => void
  setDefaultSynthesisSettings: (s: SynthesisSettings) => void

  // Per-account mutations (operate on the active account when id omitted)
  updateAccount: (id: string, patch: Partial<SelfAccount>) => void
  setProfile: (id: string, profile: Profile | null) => void
  setPosts: (id: string, posts: Post[]) => void
  setBookmarks: (id: string, bookmarks: Post[]) => void
  setLikes: (id: string, likes: Post[]) => void
  setEdges: (id: string, edges: Edge[]) => void
  markRefreshed: (id: string, section: keyof SelfSectionsRefreshed) => void
  setSynthesisSettings: (id: string, patch: Partial<SynthesisSettings>) => void
  appendReport: (id: string, snapshot: IntelReportSnapshot) => void
  setActiveReport: (id: string, reportId: string) => void
  deleteReport: (id: string, reportId: string) => void

  /** Drop all live connection flags but keep cached data. */
  disconnectAll: () => void
  /** Hard-clear everything (cached data + flags). */
  reset: () => void
}

export const useXSelfStore = create<XSelfState>()(
  persist(
    (set) => ({
      accounts: {},
      accountOrder: [],
      activeAccountId: null,
      connecting: false,
      connected: false,
      defaultSynthesisSettings: DEFAULT_SYNTHESIS_SETTINGS,

      upsertAccount: ({ id, username }) =>
        set((s) => {
          if (s.accounts[id]) {
            // Refresh username only (profile/posts kept).
            return { accounts: { ...s.accounts, [id]: { ...s.accounts[id], username } } }
          }
          return {
            accounts: { ...s.accounts, [id]: emptyAccount(id, username, s.defaultSynthesisSettings) },
            accountOrder: [...s.accountOrder, id],
          }
        }),

      removeAccount: (id) =>
        set((s) => {
          const accounts = { ...s.accounts }
          delete accounts[id]
          const accountOrder = s.accountOrder.filter((a) => a !== id)
          const activeAccountId = s.activeAccountId === id ? (accountOrder[0] ?? null) : s.activeAccountId
          return { accounts, accountOrder, activeAccountId }
        }),

      setActiveAccount: (id) => set({ activeAccountId: id }),
      setConnecting: (connecting) => set({ connecting }),
      setConnected: (connected) => set({ connected }),
      setDefaultSynthesisSettings: (settings) => set({ defaultSynthesisSettings: settings }),

      updateAccount: (id, patch) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, ...patch } } }
        }),

      setProfile: (id, profile) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, profile } } }
        }),

      setPosts: (id, posts) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, posts } } }
        }),

      setBookmarks: (id, bookmarks) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, bookmarks } } }
        }),

      setLikes: (id, likes) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, likes } } }
        }),

      setEdges: (id, edges) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return { accounts: { ...s.accounts, [id]: { ...a, edges } } }
        }),

      markRefreshed: (id, section) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return {
            accounts: {
              ...s.accounts,
              [id]: { ...a, refreshedAt: { ...a.refreshedAt, [section]: new Date().toISOString() } },
            },
          }
        }),

      setSynthesisSettings: (id, patch) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return {
            accounts: {
              ...s.accounts,
              [id]: { ...a, synthesisSettings: { ...a.synthesisSettings, ...patch } },
            },
          }
        }),

      appendReport: (id, snapshot) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          return {
            accounts: {
              ...s.accounts,
              [id]: {
                ...a,
                reportHistory: [snapshot, ...a.reportHistory],
                activeReportId: snapshot.id,
              },
            },
          }
        }),

      setActiveReport: (id, reportId) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          if (!a.reportHistory.some((r) => r.id === reportId)) return s
          return { accounts: { ...s.accounts, [id]: { ...a, activeReportId: reportId } } }
        }),

      deleteReport: (id, reportId) =>
        set((s) => {
          const a = s.accounts[id]
          if (!a) return s
          const reportHistory = a.reportHistory.filter((r) => r.id !== reportId)
          const activeReportId = a.activeReportId === reportId ? (reportHistory[0]?.id ?? null) : a.activeReportId
          return { accounts: { ...s.accounts, [id]: { ...a, reportHistory, activeReportId } } }
        }),

      disconnectAll: () => set({ connecting: false, connected: false, activeAccountId: null }),
      reset: () => set({ accounts: {}, accountOrder: [], activeAccountId: null, connecting: false, connected: false }),
    }),
    {
      name: 'x-self-profile',
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<XSelfState> & {
          // v1 flat fields
          profile?: Profile | null
          posts?: Post[]
          bookmarks?: Post[]
          likes?: Post[]
          edges?: Edge[]
          reportHistory?: IntelReportSnapshot[]
          activeReportId?: string | null
          refreshedAt?: SelfSectionsRefreshed
          synthesisSettings?: SynthesisSettings
          connected?: boolean
        }
        // v1 → v2: fold the legacy flat singleton into accounts[profile.id].
        if (version < 2 && state.profile) {
          const id = state.profile.id
          const synthesis = state.synthesisSettings ?? DEFAULT_SYNTHESIS_SETTINGS
          state.accounts = {
            ...(state.accounts ?? {}),
            [id]: {
              id,
              username: state.profile.username,
              profile: state.profile,
              posts: state.posts ?? [],
              bookmarks: state.bookmarks ?? [],
              likes: state.likes ?? [],
              edges: state.edges ?? [],
              reportHistory: state.reportHistory ?? [],
              activeReportId: state.activeReportId ?? null,
              refreshedAt: state.refreshedAt ?? {},
              synthesisSettings: synthesis,
            },
          }
          state.accountOrder = [id]
          state.activeAccountId = id
          state.defaultSynthesisSettings = state.defaultSynthesisSettings ?? synthesis
          delete state.profile
          delete state.posts
          delete state.bookmarks
          delete state.likes
          delete state.edges
          delete state.reportHistory
          delete state.activeReportId
          delete state.refreshedAt
          delete state.synthesisSettings
          delete state.connected
        }
        return state as XSelfState
      },
      partialize: (s) => ({
        accounts: s.accounts,
        accountOrder: s.accountOrder,
        activeAccountId: s.activeAccountId,
        defaultSynthesisSettings: s.defaultSynthesisSettings,
      }),
    },
  ),
)

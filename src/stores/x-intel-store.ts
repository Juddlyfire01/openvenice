import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Post, Edge, CharacterProfile, SynthesisSettings, IntelReportSnapshot } from '../lib/x-intel/types'
import { DEFAULT_SYNTHESIS_SETTINGS } from '../lib/x-intel/types'
import { computeAnalytics, postDateRange } from '../lib/x-intel/analytics'

/** Small id generator; crypto.randomUUID where available, else a random fallback. */
export function newReportId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Convert a legacy v1 CharacterProfile synthesis into a v2 baseline snapshot so
 * upgrading users lose nothing. Analytics are recomputed from the persisted
 * posts/edges/profile; the character fields map into the narrative. Returns null
 * when there isn't enough data (no profile) to build a valid snapshot.
 */
function legacyToSnapshot(
  synthesis: CharacterProfile,
  profile: Profile | null,
  posts: Post[],
  edges: Edge[],
  settings: SynthesisSettings,
): IntelReportSnapshot | null {
  if (!profile) return null
  return {
    id: newReportId(),
    createdAt: synthesis.synthesizedAt || new Date().toISOString(),
    model: synthesis.model,
    synthesisSettings: settings,
    meta: {
      postCount: posts.length,
      dateRange: postDateRange(posts),
      postIdsAnalyzed: posts.map((p) => p.id),
      tokenCost: 0,
    },
    analytics: computeAnalytics(profile, posts, edges),
    narrative: {
      executiveSummary: '',
      strategicAssessment: '',
      themes: synthesis.themes.map((t) => ({ name: t, evidence: '', weight: 0 })),
      register: { description: synthesis.register, devices: [] },
      narrativeArcs: [],
      audienceRead: '',
      contradictions: [],
      notablePosts: synthesis.flagshipPost?.postId
        ? [{ postId: synthesis.flagshipPost.postId, why: 'Flagship post (migrated from prior profile)' }]
        : [],
      engagementHooks: [],
      analystConclusions: [],
    },
    changeSummary: null,
    previousReportId: null,
  }
}

// Per-section "last successfully refreshed" timestamps (ISO). Distinct from a
// post's gatheredAt: a refresh that returns zero new posts is still a successful
// refresh and must bump the relevant section here, even though no post changes.
export interface RefreshedAt {
  profile?: string
  feed?: string
  network?: string
}

export interface IntelReport {
  username: string          // canonical (as entered, trimmed, no @)
  profile: Profile | null
  posts: Post[]             // newest first
  edges: Edge[]
  reportHistory: IntelReportSnapshot[]  // append-only, newest first
  activeReportId: string | null         // which snapshot the right pane shows
  synthesisSettings: SynthesisSettings
  drafts: { id: string; text: string; createdAt: string }[]
  watch: boolean            // refresh on tab open
  totalCost: number
  createdAt: string
  refreshedAt: RefreshedAt
}

export type IntelSubTab = 'profile' | 'network' | 'feed' | 'draft'
export type IntelTopTab = 'me' | 'targets'

interface XIntelState {
  targets: string[]
  reports: Record<string, IntelReport>
  activeTarget: string | null
  activeSubTab: IntelSubTab
  activeTopTab: IntelTopTab
  sessionCost: number
  /** Persisted all-time spend across all targets (survives target removal). */
  lifetimeTotal: number
  defaultSynthesisSettings: SynthesisSettings

  addTarget: (username: string) => void
  seedTarget: (profile: Profile) => void
  removeTarget: (username: string) => void
  setActiveTarget: (username: string | null) => void
  setActiveSubTab: (tab: IntelSubTab) => void
  setActiveTopTab: (tab: IntelTopTab) => void
  updateReport: (username: string, patch: Partial<IntelReport>) => void
  addCost: (username: string, cost: number) => void
  setDefaultSynthesisSettings: (s: SynthesisSettings) => void
  appendReport: (username: string, snapshot: IntelReportSnapshot) => void
  deleteReport: (username: string, reportId: string) => void
  setActiveReport: (username: string, reportId: string) => void
}

export function mergePosts(existing: Post[], incoming: Post[]): Post[] {
  const map = new Map<string, Post>()
  for (const p of existing) map.set(p.id, p)
  for (const p of incoming) map.set(p.id, p)
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function canonical(username: string): string {
  return username.trim().replace(/^@/, '')
}

function findReportKey(reports: Record<string, IntelReport>, username: string): string | undefined {
  const name = canonical(username).toLowerCase()
  return Object.keys(reports).find((k) => k.toLowerCase() === name)
}

export const useXIntelStore = create<XIntelState>()(
  persist(
    (set, get) => ({
      targets: [],
      reports: {},
      activeTarget: null,
      activeSubTab: 'profile',
      activeTopTab: 'me',
      sessionCost: 0,
      lifetimeTotal: 0,
      defaultSynthesisSettings: DEFAULT_SYNTHESIS_SETTINGS,

      addTarget: (username) => {
        const name = canonical(username)
        if (!name) return
        const existing = get().targets.find((t) => t.toLowerCase() === name.toLowerCase())
        if (existing) {
          set({ activeTarget: existing })
          return
        }
        set((s) => ({
          targets: [...s.targets, name],
          activeTarget: name,
          reports: {
            ...s.reports,
            [name]: {
              username: name,
              profile: null,
              posts: [],
              edges: [],
              reportHistory: [],
              activeReportId: null,
              synthesisSettings: { ...s.defaultSynthesisSettings },
              drafts: [],
              watch: false,
              totalCost: 0,
              createdAt: new Date().toISOString(),
              refreshedAt: {},
            },
          },
        }))
      },

      // Seed a target from an already-fetched profile (e.g. the token-validation
      // lookup) without spending another request. If the target already exists,
      // only its profile is refreshed — posts, edges, drafts and cost are kept.
      seedTarget: (profile) => {
        const name = canonical(profile.username)
        if (!name) return
        set((s) => {
          const existingKey = findReportKey(s.reports, name)
          if (existingKey) {
            const report = s.reports[existingKey]
            return {
              reports: {
                ...s.reports,
                [existingKey]: {
                  ...report,
                  profile,
                  refreshedAt: { ...report.refreshedAt, profile: new Date().toISOString() },
                },
              },
            }
          }
          return {
            targets: [...s.targets, name],
            activeTarget: s.activeTarget ?? name,
            reports: {
              ...s.reports,
              [name]: {
                username: name,
                profile,
                posts: [],
                edges: [],
                reportHistory: [],
                activeReportId: null,
                synthesisSettings: { ...s.defaultSynthesisSettings },
                drafts: [],
                watch: false,
                totalCost: 0,
                createdAt: new Date().toISOString(),
                refreshedAt: { profile: new Date().toISOString() },
              },
            },
          }
        })
      },

      removeTarget: (username) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s
          const reports = { ...s.reports }
          delete reports[key]
          const targets = s.targets.filter((t) => t !== key)
          return {
            targets,
            reports,
            activeTarget: s.activeTarget === key ? (targets[0] ?? null) : s.activeTarget,
          }
        })
      },

      setActiveTarget: (username) => set({ activeTarget: username }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setActiveTopTab: (tab) => set({ activeTopTab: tab }),

      updateReport: (username, patch) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s
          const report = s.reports[key]
          return { reports: { ...s.reports, [key]: { ...report, ...patch } } }
        })
      },

      addCost: (username, cost) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s  // no-op for non-existent target — don't charge sessionCost either
          const report = s.reports[key]
          return {
            sessionCost: s.sessionCost + cost,
            lifetimeTotal: s.lifetimeTotal + cost,
            reports: { ...s.reports, [key]: { ...report, totalCost: report.totalCost + cost } },
          }
        })
      },

      setDefaultSynthesisSettings: (settings) => set({ defaultSynthesisSettings: settings }),

      appendReport: (username, snapshot) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s
          const report = s.reports[key]
          return {
            reports: {
              ...s.reports,
              [key]: {
                ...report,
                reportHistory: [snapshot, ...report.reportHistory],
                activeReportId: snapshot.id,
              },
            },
          }
        })
      },

      deleteReport: (username, reportId) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s
          const report = s.reports[key]
          const reportHistory = report.reportHistory.filter((r) => r.id !== reportId)
          const activeReportId = report.activeReportId === reportId
            ? (reportHistory[0]?.id ?? null)
            : report.activeReportId
          return {
            reports: { ...s.reports, [key]: { ...report, reportHistory, activeReportId } },
          }
        })
      },

      setActiveReport: (username, reportId) => {
        set((s) => {
          const key = findReportKey(s.reports, username)
          if (!key) return s
          const report = s.reports[key]
          if (!report.reportHistory.some((r) => r.id === reportId)) return s
          return { reports: { ...s.reports, [key]: { ...report, activeReportId: reportId } } }
        })
      },
    }),
    {
      name: 'x-intel-reports',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Partial<XIntelState>
        if (version < 1 && state.reports && state.lifetimeTotal == null) {
          state.lifetimeTotal = Object.values(state.reports).reduce(
            (sum, r) => sum + (r.totalCost ?? 0),
            0,
          )
        }
        // v1 -> v2: fold each report's single `synthesis` (CharacterProfile) into
        // an append-only `reportHistory` baseline snapshot; nothing is lost.
        if (version < 2 && state.reports) {
          for (const report of Object.values(state.reports) as (IntelReport & { synthesis?: CharacterProfile | null })[]) {
            if (report.reportHistory) continue // already migrated
            const legacy = report.synthesis ?? null
            const settings = report.synthesisSettings ?? DEFAULT_SYNTHESIS_SETTINGS
            const snapshot = legacy
              ? legacyToSnapshot(legacy, report.profile ?? null, report.posts ?? [], report.edges ?? [], settings)
              : null
            report.reportHistory = snapshot ? [snapshot] : []
            report.activeReportId = snapshot?.id ?? null
            delete report.synthesis
          }
        }
        // v2 -> v3: backfill link entity fields on cached profiles.
        if (version < 3 && state.reports) {
          for (const report of Object.values(state.reports)) {
            if (!report.profile) continue
            if (!Array.isArray(report.profile.bioUrls)) report.profile.bioUrls = []
            if (report.profile.website === undefined) report.profile.website = null
          }
        }
        return state as XIntelState
      },
      partialize: (s) => ({
        targets: s.targets,
        reports: s.reports,
        activeTarget: s.activeTarget,
        lifetimeTotal: s.lifetimeTotal,
        defaultSynthesisSettings: s.defaultSynthesisSettings,
      }),
    },
  ),
)

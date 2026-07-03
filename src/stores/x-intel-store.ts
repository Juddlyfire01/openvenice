import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Post, Edge, CharacterProfile, SynthesisSettings } from '../lib/x-intel/types'
import { DEFAULT_SYNTHESIS_SETTINGS } from '../lib/x-intel/types'

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
  synthesis: CharacterProfile | null
  synthesisSettings: SynthesisSettings
  drafts: { id: string; text: string; createdAt: string }[]
  watch: boolean            // refresh on tab open
  totalCost: number
  createdAt: string
  refreshedAt: RefreshedAt
}

export type IntelSubTab = 'profile' | 'network' | 'feed' | 'draft'

interface XIntelState {
  targets: string[]
  reports: Record<string, IntelReport>
  activeTarget: string | null
  activeSubTab: IntelSubTab
  sessionCost: number
  defaultSynthesisSettings: SynthesisSettings

  addTarget: (username: string) => void
  seedTarget: (profile: Profile) => void
  removeTarget: (username: string) => void
  setActiveTarget: (username: string | null) => void
  setActiveSubTab: (tab: IntelSubTab) => void
  updateReport: (username: string, patch: Partial<IntelReport>) => void
  addCost: (username: string, cost: number) => void
  setDefaultSynthesisSettings: (s: SynthesisSettings) => void
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
      sessionCost: 0,
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
              synthesis: null,
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
                synthesis: null,
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
            reports: { ...s.reports, [key]: { ...report, totalCost: report.totalCost + cost } },
          }
        })
      },

      setDefaultSynthesisSettings: (settings) => set({ defaultSynthesisSettings: settings }),
    }),
    {
      name: 'x-intel-reports',
      partialize: (s) => ({
        targets: s.targets,
        reports: s.reports,
        activeTarget: s.activeTarget,
        defaultSynthesisSettings: s.defaultSynthesisSettings,
      }),
    },
  ),
)

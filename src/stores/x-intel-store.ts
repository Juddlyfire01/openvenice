import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Post, Edge, CharacterProfile, SynthesisSettings } from '../lib/x-intel/types'
import { DEFAULT_SYNTHESIS_SETTINGS } from '../lib/x-intel/types'

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
            },
          },
        }))
      },

      removeTarget: (username) => {
        set((s) => {
          const reports = { ...s.reports }
          delete reports[username]
          const targets = s.targets.filter((t) => t !== username)
          return {
            targets,
            reports,
            activeTarget: s.activeTarget === username ? (targets[0] ?? null) : s.activeTarget,
          }
        })
      },

      setActiveTarget: (username) => set({ activeTarget: username }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),

      updateReport: (username, patch) => {
        set((s) => {
          const report = s.reports[username]
          if (!report) return s
          return { reports: { ...s.reports, [username]: { ...report, ...patch } } }
        })
      },

      addCost: (username, cost) => {
        set((s) => {
          const report = s.reports[username]
          return {
            sessionCost: s.sessionCost + cost,
            reports: report
              ? { ...s.reports, [username]: { ...report, totalCost: report.totalCost + cost } }
              : s.reports,
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

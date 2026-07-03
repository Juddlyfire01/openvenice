import { describe, it, expect, beforeEach } from 'vitest'
import { useXIntelStore, mergePosts } from './x-intel-store'
import type { Post } from '../lib/x-intel/types'

const makePost = (id: string, createdAt: string): Post => ({
  id, authorId: '42', text: `post ${id}`, lang: 'en', createdAt,
  metrics: { impressions: 0, likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 },
  kind: 'original', referenced: [], urls: [], mentions: [], mediaKeys: [],
  contextAnnotations: [], gatheredAt: createdAt,
})

describe('mergePosts', () => {
  it('dedupes by id, newer gatheredAt wins, sorted newest first', () => {
    const existing = [makePost('1', '2026-06-01T00:00:00Z'), makePost('2', '2026-06-02T00:00:00Z')]
    const incoming = [makePost('2', '2026-06-02T00:00:00Z'), makePost('3', '2026-06-03T00:00:00Z')]
    const merged = mergePosts(existing, incoming)
    expect(merged.map((p) => p.id)).toEqual(['3', '2', '1'])
  })
})

describe('useXIntelStore', () => {
  beforeEach(() => {
    useXIntelStore.setState({ targets: [], reports: {}, activeTarget: null, sessionCost: 0 })
  })

  it('addTarget creates an empty report and selects it', () => {
    useXIntelStore.getState().addTarget('ErikVoorhees')
    const s = useXIntelStore.getState()
    expect(s.targets).toEqual(['ErikVoorhees'])
    expect(s.activeTarget).toBe('ErikVoorhees')
    expect(s.reports['ErikVoorhees']).toBeDefined()
    expect(s.reports['ErikVoorhees'].posts).toEqual([])
  })

  it('addTarget is idempotent per username (case-insensitive)', () => {
    useXIntelStore.getState().addTarget('ErikVoorhees')
    useXIntelStore.getState().addTarget('erikvoorhees')
    expect(useXIntelStore.getState().targets).toHaveLength(1)
  })

  it('removeTarget deletes report and deselects', () => {
    useXIntelStore.getState().addTarget('ErikVoorhees')
    useXIntelStore.getState().removeTarget('ErikVoorhees')
    const s = useXIntelStore.getState()
    expect(s.targets).toEqual([])
    expect(s.reports['ErikVoorhees']).toBeUndefined()
    expect(s.activeTarget).toBeNull()
  })

  it('addCost accumulates session and per-target cost', () => {
    useXIntelStore.getState().addTarget('ErikVoorhees')
    useXIntelStore.getState().addCost('ErikVoorhees', 0.26)
    useXIntelStore.getState().addCost('ErikVoorhees', 0.01)
    const s = useXIntelStore.getState()
    expect(s.sessionCost).toBeCloseTo(0.27)
    expect(s.reports['ErikVoorhees'].totalCost).toBeCloseTo(0.27)
  })
})

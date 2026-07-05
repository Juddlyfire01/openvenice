// Orchestration for the connected user's OWN data (Profile tab). Reuses the
// exact analytics + synthesis pipeline that targets use, so the self-report is
// structurally identical to a target report (everything a target has) — plus
// bookmarks/likes context the target path can't access.
import { gatherSelfProfile, gatherSelfPosts, gatherSelfBookmarks, gatherSelfLikes } from './self-gather'
import { getSelfSession } from './self-client'
import { deriveEdges } from './normalize'
import { computeAnalytics, computeDelta, postDateRange } from './analytics'
import { synthesizeReport } from './synthesize'
import { mergePosts, newReportId, useXIntelStore } from '../../stores/x-intel-store'
import { useXSelfStore } from '../../stores/x-self-store'
import { useSettingsStore } from '../../stores/settings-store'
import { toast } from '../../stores/toast-store'
import { runGather } from './orchestrate'
import { DEFAULT_TARGET } from './fields'
import { DEFAULT_SYNTHESIS_SETTINGS } from './types'
import type { IntelReportSnapshot, ChangeSummary } from './types'

let sessionRefreshPromise: Promise<boolean> | null = null
let oauthBootstrapPromise: ReturnType<typeof runOAuthBootstrap> | null = null

async function probeSelfSession(): Promise<boolean> {
  const { connected } = await getSelfSession()
  useXSelfStore.getState().setConnected(connected)
  if (connected) seedDefaultTarget()
  return connected
}

/**
 * Probe the server session and reflect it into the store. Concurrent callers
 * share one in-flight request so IntelView + SelfProfileView cannot race and
 * overwrite each other with stale disconnected results.
 */
export function refreshSelfSession(): Promise<boolean> {
  sessionRefreshPromise ??= probeSelfSession().finally(() => {
    sessionRefreshPromise = null
  })
  return sessionRefreshPromise
}

export interface OAuthBootstrapResult {
  connected: boolean
  oauthReturn: boolean
  oauthError: string | null
}

/**
 * Run once on app load: reconcile the OAuth session, surface callback errors,
 * switch to Intel after a successful connect, and strip ?x_connected / ?x_error
 * from the URL regardless of which tab is active.
 */
export function bootstrapXOAuthReturn(): Promise<OAuthBootstrapResult> {
  oauthBootstrapPromise ??= runOAuthBootstrap()
  return oauthBootstrapPromise
}

async function runOAuthBootstrap(): Promise<OAuthBootstrapResult> {
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('x_error')
  const oauthReturn = params.get('x_connected') === '1' || !!oauthError

  let connected = false
  try {
    connected = await refreshSelfSession()
    // Auth cookies are set on the callback 302; retry once if the probe races the redirect.
    if (oauthReturn && !oauthError && !connected) {
      await new Promise((r) => setTimeout(r, 150))
      connected = await refreshSelfSession()
    }
  } catch {
    connected = false
  }

  if (oauthReturn) {
    window.history.replaceState({}, '', window.location.pathname)
  }

  if (oauthError) {
    toast.error('X connect failed', oauthError)
  } else if (oauthReturn && connected) {
    useSettingsStore.getState().setActiveTab('intel')
    toast.success('Connected to X')
  } else if (oauthReturn && !connected) {
    toast.error('X connect failed', 'Session could not be established after redirect.')
  }

  return { connected, oauthReturn, oauthError }
}

/** Add @AskVenice as the first target (and gather it) when none exist yet. */
function seedDefaultTarget(): void {
  const trySeed = () => {
    const intel = useXIntelStore.getState()
    if (intel.targets.length > 0) return
    intel.addTarget(DEFAULT_TARGET)
    runGather(DEFAULT_TARGET).catch(() => { /* surfaced in the target rail */ })
  }

  if (useXIntelStore.persist.hasHydrated()) {
    trySeed()
  } else {
    useXIntelStore.persist.onFinishHydration(trySeed)
  }
}

/** Full gather of the connected user: profile → posts → bookmarks → likes → edges. */
export async function gatherSelf(opts: { maxResults?: number } = {}): Promise<void> {
  const store = useXSelfStore.getState()

  const profile = await gatherSelfProfile()
  store.setProfile(profile)
  store.markRefreshed('profile')

  const [posts, bookmarks, likes] = await Promise.all([
    gatherSelfPosts(profile.id, opts).catch(() => [] as never[]),
    gatherSelfBookmarks(profile.id, opts).catch(() => [] as never[]),
    gatherSelfLikes(profile.id, opts).catch(() => [] as never[]),
  ])

  const mergedPosts = mergePosts(useXSelfStore.getState().posts, posts)
  store.setPosts(mergedPosts)
  store.markRefreshed('posts')

  store.setBookmarks(mergePosts(useXSelfStore.getState().bookmarks, bookmarks))
  store.markRefreshed('bookmarks')

  store.setLikes(mergePosts(useXSelfStore.getState().likes, likes))
  store.markRefreshed('likes')

  store.setEdges(deriveEdges(profile.id, mergedPosts))
}

/** Refresh only the self profile (cheap identity/metrics refresh). */
export async function refreshSelfProfile(): Promise<void> {
  const store = useXSelfStore.getState()
  const profile = await gatherSelfProfile()
  store.setProfile(profile)
  store.markRefreshed('profile')
}

/** Generate a full intelligence report over the connected user's own posts. */
export async function generateSelfReport(): Promise<IntelReportSnapshot> {
  const state = useXSelfStore.getState()
  if (!state.profile) throw new Error('Load your profile first')
  if (state.posts.length === 0) throw new Error('Gather your posts first')

  const settings = DEFAULT_SYNTHESIS_SETTINGS
  const analytics = computeAnalytics(state.profile, state.posts, state.edges)
  const prevSnapshot = state.reportHistory[0] ?? null

  let computedDelta: Omit<ChangeSummary, 'narrative'> | null = null
  if (prevSnapshot) {
    const prevIds = new Set(prevSnapshot.meta.postIdsAnalyzed)
    const newPostIds = state.posts.map((p) => p.id).filter((id) => !prevIds.has(id))
    const newPosts = state.posts.filter((p) => !prevIds.has(p.id))
    computedDelta = computeDelta(prevSnapshot.analytics, analytics, newPostIds, postDateRange(newPosts))
  }

  const { narrative, changeNarrative, tokenCost } = await synthesizeReport(
    state.profile, state.posts, analytics, computedDelta, prevSnapshot, settings,
  )

  const snapshot: IntelReportSnapshot = {
    id: newReportId(),
    createdAt: new Date().toISOString(),
    model: settings.model,
    synthesisSettings: { ...settings },
    meta: {
      postCount: state.posts.length,
      dateRange: postDateRange(state.posts),
      postIdsAnalyzed: state.posts.map((p) => p.id),
      tokenCost,
    },
    analytics,
    narrative,
    changeSummary: computedDelta ? { ...computedDelta, narrative: changeNarrative ?? '' } : null,
    previousReportId: prevSnapshot?.id ?? null,
  }

  useXSelfStore.getState().appendReport(snapshot)
  return snapshot
}

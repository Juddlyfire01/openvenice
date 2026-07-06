import { useEffect, useState } from 'react'
import { useXSelfStore } from '../../stores/x-self-store'
import { refreshSelfSession, gatherSelf } from '../../lib/x-intel/self-orchestrate'
import { beginSelfLogin, selfLogout } from '../../lib/x-intel/self-client'
import { linkify } from '../../lib/x-intel/linkify'
import { formatTokens } from '../../lib/utils'
import { computeActivity } from '../../lib/x-intel/activity'
import { ProfileOverview } from './profile-overview'
import { SelfReport } from './self-report'
import { Spinner } from '../ui/spinner'
import type { Profile } from '../../lib/x-intel/types'

/** Bio with clickable URLs / mentions / hashtags (mentions open on X here —
 *  the self view has no target concept to add into). */
function SelfBio({ text, bioUrls }: { text: string; bioUrls?: { url: string; expanded: string; display: string }[] }) {
  const linkCls = 'text-[var(--color-accent)] hover:underline'
  return (
    <p className="text-[12px] text-white/50 mt-1.5 break-words">
      {linkify(text, bioUrls).map((tok, i) => {
        if (tok.type === 'url' || tok.type === 'hashtag') {
          const href = tok.type === 'url' ? tok.href : `https://x.com/hashtag/${encodeURIComponent(tok.tag)}`
          return <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className={linkCls}>{tok.value}</a>
        }
        if (tok.type === 'mention') {
          return <a key={i} href={`https://x.com/${tok.username}`} target="_blank" rel="noopener noreferrer nofollow" className={linkCls}>{tok.value}</a>
        }
        return <span key={i}>{tok.value}</span>
      })}
    </p>
  )
}

function ConnectCta() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-6">
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-[15px] font-semibold text-white/85">Connect your X account</h2>
        <p className="text-[12px] text-white/40 leading-relaxed">
          Sign in with X (OAuth 2.0) to unlock your verified profile, your posts, and
          — unlike target analysis — your <b className="text-white/60">bookmarks</b> and{' '}
          <b className="text-white/60">likes</b>. Your account is analyzed with the same
          intelligence report engine used for targets.
        </p>
      </div>
      <button
        onClick={beginSelfLogin}
        className="px-4 py-2 text-[12px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors"
      >
        Connect X
      </button>
      <p className="text-[10px] text-white/25 max-w-xs">
        Tokens are held server-side in a secure, HttpOnly cookie — never exposed to the browser.
      </p>
    </div>
  )
}

/**
 * Informational loading screen shown during the OAuth round-trip and the
 * post-redirect profile gather. Replaces the dead-end "Connect button reappears
 * then profile pops in" sequence with explicit phase copy so the user always
 * knows what's happening.
 *
 * - phase="authorizing": OAuth redirect in flight (click → x.com → return) or
 *   the session probe is still resolving after the callback.
 * - phase="syncing": session is connected but the first profile/posts/bookmarks
 *   gather is running. Can surface a retry button if that gather fails.
 */
function XConnectFlow({
  phase,
  busy,
  error,
  onRetry,
}: {
  phase: 'authorizing' | 'syncing'
  busy?: boolean
  error?: string | null
  onRetry?: () => void
}) {
  const title = phase === 'authorizing' ? 'Connecting to X…' : 'Syncing your profile…'
  const subtitle = phase === 'authorizing'
    ? 'Authorizing your account with X. You’ll be back here in a moment.'
    : 'Fetching your profile, posts, bookmarks & likes.'
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-6 animate-fade-in">
      <Spinner className="h-5 w-5 text-[var(--color-accent)]" />
      <div className="space-y-1 max-w-sm">
        <h2 className="text-[15px] font-semibold text-white/85">{title}</h2>
        <p className="text-[12px] text-white/40 leading-relaxed">{subtitle}</p>
      </div>
      {phase === 'syncing' && error && (
        <div className="space-y-2 max-w-sm">
          <p className="text-[11px] text-red-400/70">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={busy}
              className="px-3 py-1.5 text-[12px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Retrying…' : 'Retry gather'}
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-white/25 max-w-xs">
        Tokens are held server-side in a secure, HttpOnly cookie — never exposed to the browser.
      </p>
    </div>
  )
}

export function SelfProfileView() {
  const connected = useXSelfStore((s) => s.connected)
  const connecting = useXSelfStore((s) => s.connecting)
  const profile = useXSelfStore((s) => s.profile)
  const posts = useXSelfStore((s) => s.posts)
  const bookmarks = useXSelfStore((s) => s.bookmarks)
  const likes = useXSelfStore((s) => s.likes)
  const refreshedAt = useXSelfStore((s) => s.refreshedAt)
  const synthesisSettings = useXSelfStore((s) => s.synthesisSettings)
  const setSynthesisSettings = useXSelfStore((s) => s.setSynthesisSettings)

  // The zustand persist middleware hydrates from localStorage asynchronously.
  // On a fresh page load (incl. the OAuth redirect return) the store starts with
  // empty defaults (reportHistory: [], profile: null) and then re-hydrates a
  // frame or two later. Without tracking this we'd flash "No report yet" and
  // kick off a redundant gather even when a cached profile exists on disk.
  const [hydrated, setHydrated] = useState(useXSelfStore.persist.hasHydrated())
  useEffect(() => {
    if (hydrated) return
    const unsub = useXSelfStore.persist.onFinishHydration(() => setHydrated(true))
    if (useXSelfStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [hydrated])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runRefresh = async () => {
    setBusy(true); setError(null)
    try { await gatherSelf() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gather failed') }
    finally { setBusy(false) }
  }

  // After the shared session probe (app bootstrap or Intel mount), sync profile
  // data — but only once the persist layer has hydrated, otherwise we'd gather
  // even when a cached profile is about to reappear from localStorage.
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    void refreshSelfSession().then((isConnected) => {
      if (cancelled || !isConnected || useXSelfStore.getState().profile) return
      setBusy(true)
      setError(null)
      gatherSelf()
        .catch((e) => setError(e instanceof Error ? e.message : 'Gather failed'))
        .finally(() => { if (!cancelled) setBusy(false) })
    })
    return () => { cancelled = true }
  }, [hydrated])

  const disconnect = async () => {
    await selfLogout()
    // Soft-disconnect: keep cached profile/posts/reports so a reconnect is
    // instant and the UI never flashes empty states. reset() is a hard wipe.
    useXSelfStore.getState().disconnect()
  }

  // OAuth round-trip in flight (click → x.com → return, or session probe still
  // resolving after the callback). Show the authorizing screen instead of the
  // Connect CTA so the user sees the connection process has begun.
  if (connecting) return <XConnectFlow phase="authorizing" />

  if (!connected) return <ConnectCta />

  // Connected but no profile yet. If we're still waiting on persist hydration,
  // the profile may well be sitting in localStorage about to reappear — show the
  // syncing screen rather than flashing the empty state. Once hydrated (and
  // still no profile), this is the genuine first-gather phase right after OAuth.
  if (connected && !profile) {
    return (
      <XConnectFlow
        phase="syncing"
        busy={busy || !hydrated}
        error={hydrated ? error : null}
        onRetry={runRefresh}
      />
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left: identity + metrics (shared with the Targets tab) */}
      <div className="lg:w-[340px] lg:shrink-0 lg:border-r border-white/[0.05] lg:h-full min-h-0">
        <ProfileOverview
          profile={profile}
          connected={connected}
          refreshing={busy}
          refreshError={error}
          lastGatheredIso={refreshedAt.profile ?? profile?.gatheredAt}
          onRefresh={runRefresh}
          emptyHint="Fetch your profile, posts, bookmarks & likes in one pull."
          showYouBadge
          renderBio={(p: Profile) => <SelfBio text={p.bio ?? ''} bioUrls={p.bioUrls} />}
          extraSection={
            <div className="pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[11px] text-white/30 font-mono">
              <span><b className="text-white/60">{formatTokens(bookmarks.length)}</b> bookmarks</span>
              <span><b className="text-white/60">{formatTokens(likes.length)}</b> likes gathered</span>
            </div>
          }
          activity={profile ? computeActivity(profile, posts) : null}
          synthesisSettings={synthesisSettings}
          onSynthesisChange={setSynthesisSettings}
          onDisconnect={disconnect}
        />
      </div>

      {/* Right: report (reuses the target analytics + narrative pipeline) */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <SelfReport />
      </div>
    </div>
  )
}

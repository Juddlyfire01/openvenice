import { useEffect, useState } from 'react'
import { useXSelfStore } from '../../stores/x-self-store'
import { refreshSelfSession, gatherSelf } from '../../lib/x-intel/self-orchestrate'
import { beginSelfLogin, selfLogout } from '../../lib/x-intel/self-client'
import { linkify } from '../../lib/x-intel/linkify'
import { formatTokens } from '../../lib/utils'
import { computeActivity } from '../../lib/x-intel/activity'
import { ProfileOverview } from './profile-overview'
import { SelfReport } from './self-report'
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

export function SelfProfileView() {
  const connected = useXSelfStore((s) => s.connected)
  const profile = useXSelfStore((s) => s.profile)
  const posts = useXSelfStore((s) => s.posts)
  const bookmarks = useXSelfStore((s) => s.bookmarks)
  const likes = useXSelfStore((s) => s.likes)
  const refreshedAt = useXSelfStore((s) => s.refreshedAt)
  const synthesisSettings = useXSelfStore((s) => s.synthesisSettings)
  const setSynthesisSettings = useXSelfStore((s) => s.setSynthesisSettings)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runRefresh = async () => {
    setBusy(true); setError(null)
    try { await gatherSelf() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gather failed') }
    finally { setBusy(false) }
  }

  // After the shared session probe (app bootstrap or Intel mount), sync profile data.
  useEffect(() => {
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
  }, [])

  const disconnect = async () => {
    await selfLogout()
    useXSelfStore.getState().reset()
  }

  if (!connected) return <ConnectCta />

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

import { useEffect, useState } from 'react'
import { useXSelfStore } from '../../stores/x-self-store'
import {
  refreshSelfSession, gatherSelf, refreshSelfProfile,
} from '../../lib/x-intel/self-orchestrate'
import { beginSelfLogin, selfLogout } from '../../lib/x-intel/self-client'
import { linkify } from '../../lib/x-intel/linkify'
import { formatTokens, cn } from '../../lib/utils'
import { SelfReport } from './self-report'

/** Bio with clickable URLs / mentions / hashtags (mentions open on X here —
 *  the self view has no target concept to add into). */
function SelfBio({ text }: { text: string }) {
  const linkCls = 'text-[var(--color-accent)] hover:underline'
  return (
    <p className="text-[12px] text-white/50 mt-1.5 break-words">
      {linkify(text).map((tok, i) => {
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
  const bookmarks = useXSelfStore((s) => s.bookmarks)
  const likes = useXSelfStore((s) => s.likes)
  const refreshedAt = useXSelfStore((s) => s.refreshedAt)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runGather = async () => {
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

  const runProfileRefresh = async () => {
    setBusy(true); setError(null)
    try { await refreshSelfProfile() }
    catch (e) { setError(e instanceof Error ? e.message : 'Refresh failed') }
    finally { setBusy(false) }
  }

  const disconnect = async () => {
    await selfLogout()
    useXSelfStore.getState().reset()
  }

  if (!connected) return <ConnectCta />

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left: identity + metrics (mirrors target ProfileCard) */}
      <div className="lg:w-[340px] lg:shrink-0 lg:border-r border-white/[0.05] lg:h-full min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {profile ? (
          <>
            <div className="flex items-start gap-3">
              {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-12 h-12 rounded-full" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-semibold text-white/90 truncate">{profile.displayName}</h2>
                  {profile.verified.type && (
                    <span className={cn(
                      'text-[9px] px-1.5 py-px rounded-full font-medium',
                      profile.verified.type === 'blue' && 'bg-blue-400/15 text-blue-300/70',
                      profile.verified.type === 'business' && 'bg-yellow-400/15 text-yellow-300/70',
                      profile.verified.type === 'government' && 'bg-gray-400/15 text-gray-300/70',
                    )}>{profile.verified.type}</span>
                  )}
                  <span className="text-[9px] px-1.5 py-px rounded-full font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]/80">you</span>
                </div>
                <div className="text-[11px] text-white/25">
                  @{profile.username}
                  {profile.location && <> · {profile.location}</>}
                  {profile.accountCreated && <> · joined {new Date(profile.accountCreated).getFullYear()}</>}
                </div>
                {profile.bio && <SelfBio text={profile.bio} />}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={runGather}
                disabled={busy}
                className="px-2.5 py-1 text-[11px] font-medium bg-white/10 text-white/80 rounded-md hover:bg-white/15 transition-colors disabled:opacity-40"
              >
                {busy ? 'Syncing…' : 'Sync all'}
              </button>
              <button
                onClick={runProfileRefresh}
                disabled={busy}
                className="px-2.5 py-1 text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
              >
                Refresh profile
              </button>
            </div>
            {refreshedAt.profile && (
              <p className="text-[10px] text-white/20 font-mono">updated {new Date(refreshedAt.profile).toLocaleString()}</p>
            )}
            {error && <p className="text-[11px] text-red-400/70">{error}</p>}

            {/* Metrics grid — same four as a target, plus own likes count */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-white/30 font-mono">
              <span><b className="text-white/60">{formatTokens(profile.metrics.followers)}</b> followers</span>
              <span><b className="text-white/60">{formatTokens(profile.metrics.following)}</b> following</span>
              <span><b className="text-white/60">{formatTokens(profile.metrics.posts)}</b> posts</span>
              <span><b className="text-white/60">{formatTokens(profile.metrics.listed)}</b> listed</span>
            </div>

            {/* OAuth-only extras */}
            <div className="pt-3 border-t border-white/[0.04] grid grid-cols-2 gap-2 text-[11px] text-white/30 font-mono">
              <span><b className="text-white/60">{formatTokens(bookmarks.length)}</b> bookmarks</span>
              <span><b className="text-white/60">{formatTokens(likes.length)}</b> likes gathered</span>
            </div>

            <div className="pt-3 border-t border-white/[0.04]">
              <button onClick={disconnect} className="text-[11px] text-white/30 hover:text-red-400/80 transition-colors">
                Disconnect account
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-[12px] text-white/40">Connected. Load your profile & activity.</p>
            <button
              onClick={runGather}
              disabled={busy}
              className="px-3 py-1.5 text-[11px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-40"
            >
              {busy ? 'Syncing…' : 'Sync my data'}
            </button>
            {error && <p className="text-[11px] text-red-400/70">{error}</p>}
          </div>
        )}
      </div>

      {/* Right: report (reuses the target analytics + narrative pipeline) */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <SelfReport />
      </div>
    </div>
  )
}

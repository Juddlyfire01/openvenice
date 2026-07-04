import { useState } from 'react'
import { useXIntelStore } from '../../stores/x-intel-store'
import { useXAuthStore } from '../../stores/x-intel-auth-store'
import { useModels } from '../../hooks/use-models'
import { refreshProfile, runGather } from '../../lib/x-intel/orchestrate'
import { linkify } from '../../lib/x-intel/linkify'
import { SectionRefresh, SectionEmpty } from './section-actions'
import { formatTokens, cn } from '../../lib/utils'

/**
 * Render a bio with clickable URLs, @mentions and #hashtags. URLs and hashtags
 * open externally; a mention is a strong related-account signal, so clicking it
 * offers to add that account as a new intel target (mirrors the network graph).
 */
function BioText({ text }: { text: string }) {
  const addTarget = useXIntelStore((s) => s.addTarget)
  const bearerToken = useXAuthStore((s) => s.bearerToken)

  const addAsTarget = (username: string) => {
    if (!bearerToken) {
      alert('Set your X API key (header → X Key) to add targets from a bio mention.')
      return
    }
    if (confirm(`Add @${username} as a new intel target?`)) {
      addTarget(username)
      runGather(username).catch(() => { /* surfaced in target rail */ })
    }
  }

  const linkCls = 'text-[var(--color-accent)] hover:underline'
  return (
    <p className="text-[12px] text-white/50 mt-1.5 break-words">
      {linkify(text).map((tok, i) => {
        switch (tok.type) {
          case 'url':
            return (
              <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer nofollow" className={linkCls}>
                {tok.value}
              </a>
            )
          case 'mention':
            return (
              <button key={i} type="button" onClick={() => addAsTarget(tok.username)} className={linkCls} title={`Add @${tok.username} as a target`}>
                {tok.value}
              </button>
            )
          case 'hashtag':
            return (
              <a key={i} href={`https://x.com/hashtag/${encodeURIComponent(tok.tag)}`} target="_blank" rel="noopener noreferrer nofollow" className={linkCls}>
                {tok.value}
              </a>
            )
          default:
            return <span key={i}>{tok.value}</span>
        }
      })}
    </p>
  )
}

/**
 * Left overview column of the Profile sub-tab: identity, metrics, and the
 * per-target synthesis settings that feed report generation. The rich report
 * itself lives in the right pane (ProfileReport). Kept intentionally compact.
 */
export function ProfileCard() {
  const activeTarget = useXIntelStore((s) => s.activeTarget)
  const report = useXIntelStore((s) => (s.activeTarget ? s.reports[s.activeTarget] : undefined))
  const updateReport = useXIntelStore((s) => s.updateReport)
  const bearerToken = useXAuthStore((s) => s.bearerToken)
  const { data: models } = useModels('text')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const runRefresh = async () => {
    if (!activeTarget) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      await refreshProfile(activeTarget)
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  if (!activeTarget || !report) {
    return <div className="flex items-center justify-center h-full text-[12px] text-white/15">No target selected</div>
  }

  const { profile, synthesisSettings, reportHistory } = report
  const latest = reportHistory[0] ?? null

  const setSetting = (patch: Partial<typeof synthesisSettings>) => {
    updateReport(activeTarget, { synthesisSettings: { ...synthesisSettings, ...patch } })
  }

  if (!profile) {
    return (
      <SectionEmpty
        title="No profile gathered yet"
        hint={bearerToken ? `Fetch @${activeTarget}'s profile — one cheap user lookup.` : 'Set your X key first (header → X Key).'}
        actionLabel="Refresh profile"
        onAction={runRefresh}
        busy={refreshing}
        disabled={!bearerToken}
        error={refreshError}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
      {/* Header strip */}
      <div className="flex items-start gap-3">
        {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-12 h-12 rounded-full" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-semibold text-white/90 truncate">{profile.displayName}</h2>
            {profile.verified.type && (
              <span
                title={`Verified (${profile.verified.type})`}
                className={cn(
                  'text-[9px] px-1.5 py-px rounded-full font-medium',
                  profile.verified.type === 'blue' && 'bg-blue-400/15 text-blue-300/70',
                  profile.verified.type === 'business' && 'bg-yellow-400/15 text-yellow-300/70',
                  profile.verified.type === 'government' && 'bg-gray-400/15 text-gray-300/70',
                )}
              >
                {profile.verified.type}
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/25">
            @{profile.username}
            {profile.location && <> · {profile.location}</>}
            {profile.accountCreated && <> · joined {new Date(profile.accountCreated).getFullYear()}</>}
          </div>
          {profile.bio && <BioText text={profile.bio} />}
        </div>
      </div>

      <SectionRefresh
        onClick={runRefresh}
        busy={refreshing}
        disabled={!bearerToken}
        lastGatheredIso={report.refreshedAt?.profile ?? profile.gatheredAt}
        error={refreshError}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/30 font-mono">
        <span><b className="text-white/60">{formatTokens(profile.metrics.followers)}</b> followers</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.following)}</b> following</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.posts)}</b> posts</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.listed)}</b> listed</span>
      </div>

      {/* Latest report highlights (glance) */}
      {latest && (
        <div className="pt-3 border-t border-white/[0.04] space-y-2">
          <span className="text-[10px] font-medium text-white/15 uppercase tracking-[0.08em]">Latest report</span>
          {latest.narrative.themes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {latest.narrative.themes.slice(0, 6).map((t) => (
                <span key={t.name} className="text-[10px] px-2 py-[2px] rounded-full bg-white/[0.05] text-white/50">{t.name}</span>
              ))}
            </div>
          )}
          {latest.narrative.register.description && (
            <p className="text-[11px] text-white/45">{latest.narrative.register.description}</p>
          )}
          <p className="text-[10px] text-white/20 font-mono">
            {latest.analytics.cadence.pattern} · {latest.analytics.cadence.avgPerDay}/day · {reportHistory.length} report{reportHistory.length === 1 ? '' : 's'} on file
          </p>
        </div>
      )}

      {/* Synthesis settings (feed report generation) */}
      <div className="pt-3 border-t border-white/[0.04]">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-white/25 hover:text-white/50 uppercase tracking-[0.08em] transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          Synthesis settings
        </button>
        {settingsOpen && (
          <div className="mt-2 border border-[var(--color-border-faint)] rounded-lg p-3 bg-[var(--color-bg-raised)] space-y-3">
            <label className="block text-[11px] text-white/40">
              Context cap: <b className="text-white/70 font-mono">{synthesisSettings.contextCap}</b> posts
              <input
                type="range" min={10} max={200} step={5}
                value={synthesisSettings.contextCap}
                onChange={(e) => setSetting({ contextCap: Number(e.target.value) })}
                className="w-full accent-white mt-1"
              />
            </label>
            <label className="block text-[11px] text-white/40">
              Temperature: <b className="text-white/70 font-mono">{synthesisSettings.temperature.toFixed(1)}</b>
              <input
                type="range" min={0} max={1} step={0.1}
                value={synthesisSettings.temperature}
                onChange={(e) => setSetting({ temperature: Number(e.target.value) })}
                className="w-full accent-white mt-1"
              />
            </label>
            <label className="block text-[11px] text-white/40">
              Model
              <select
                value={synthesisSettings.model}
                onChange={(e) => setSetting({ model: e.target.value })}
                className="w-full mt-1 bg-[var(--color-bg-input)] border border-[var(--color-border-soft)] rounded-md px-2 py-1.5 text-[11px] text-[var(--color-text-secondary)] outline-none"
              >
                {(models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.model_spec?.name || m.id}</option>
                ))}
                {!models?.some((m) => m.id === synthesisSettings.model) && (
                  <option value={synthesisSettings.model}>{synthesisSettings.model}</option>
                )}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
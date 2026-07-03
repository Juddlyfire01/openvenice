import { useState } from 'react'
import { useXIntelStore } from '../../stores/x-intel-store'
import { useModels } from '../../hooks/use-models'
import { synthesizeProfile } from '../../lib/x-intel/synthesize'
import { formatTokens, cn } from '../../lib/utils'

export function ProfileCard() {
  const activeTarget = useXIntelStore((s) => s.activeTarget)
  const report = useXIntelStore((s) => (s.activeTarget ? s.reports[s.activeTarget] : undefined))
  const updateReport = useXIntelStore((s) => s.updateReport)
  const setActiveSubTab = useXIntelStore((s) => s.setActiveSubTab)
  const { data: models } = useModels('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!activeTarget || !report) {
    return <div className="flex items-center justify-center h-full text-[12px] text-white/15">No target selected</div>
  }

  const { profile, synthesis, synthesisSettings } = report

  const regenerate = async () => {
    if (!profile || report.posts.length === 0) {
      setError('Gather posts first (re-gather from the target rail)')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await synthesizeProfile(profile, report.posts, synthesisSettings)
      updateReport(activeTarget, { synthesis: result })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synthesis failed')
    } finally {
      setBusy(false)
    }
  }

  const setSetting = (patch: Partial<typeof synthesisSettings>) => {
    updateReport(activeTarget, { synthesisSettings: { ...synthesisSettings, ...patch } })
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-full text-[12px] text-white/15">No profile gathered yet</div>
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-4 max-w-2xl">
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
          {profile.bio && <p className="text-[12px] text-white/50 mt-1.5">{profile.bio}</p>}
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex gap-4 text-[11px] text-white/30 font-mono">
        <span><b className="text-white/60">{formatTokens(profile.metrics.followers)}</b> followers</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.following)}</b> following</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.posts)}</b> posts</span>
        <span><b className="text-white/60">{formatTokens(profile.metrics.listed)}</b> listed</span>
      </div>

      {/* Synthesis controls */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
        <span className="text-[10px] font-medium text-white/15 uppercase tracking-[0.08em]">Character Profile</span>
        <div className="flex-1" />
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          title="Synthesis settings"
          className="text-white/20 hover:text-white/50 transition-colors p-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        </button>
        <button
          onClick={regenerate}
          disabled={busy}
          className="px-3 py-1 text-[11px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30"
        >
          {busy ? 'Synthesizing…' : synthesis ? 'Regenerate' : 'Generate profile'}
        </button>
      </div>

      {/* Settings popover (gear) */}
      {settingsOpen && (
        <div className="border border-white/[0.06] rounded-lg p-3 bg-[#0e0e0e] space-y-3">
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
              className="w-full mt-1 bg-[#0a0a0a] border border-white/[0.08] rounded-md px-2 py-1.5 text-[11px] text-white/70 outline-none"
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

      {error && <p className="text-[11px] text-red-400/70">{error}</p>}

      {/* Synthesized character profile */}
      {synthesis ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-[11px] font-medium text-white/30 mb-1">Themes</h3>
            <div className="flex flex-wrap gap-1">
              {synthesis.themes.map((t) => (
                <span key={t} className="text-[10px] px-2 py-[2px] rounded-full bg-white/[0.05] text-white/50">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[11px] font-medium text-white/30 mb-1">Register</h3>
            <p className="text-[12px] text-white/60">{synthesis.register}</p>
          </div>
          <div>
            <h3 className="text-[11px] font-medium text-white/30 mb-1">Recurring topics</h3>
            {synthesis.recurringTopics.map((t) => (
              <div key={t.topic} className="flex justify-between text-[11px] text-white/50 py-px">
                <span>{t.topic}</span>
                <span className="font-mono text-white/25">{t.postCount} posts · {t.lastSeen}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[11px] font-medium text-white/30 mb-1">Posting cadence</h3>
            <p className="text-[11px] text-white/50 font-mono">
              {synthesis.postingCadence.pattern} · {synthesis.postingCadence.avgPerDay}/day · {synthesis.postingCadence.variance} variance
              {synthesis.postingCadence.peakWindowsUtc.length > 0 && <> · peaks {synthesis.postingCadence.peakWindowsUtc.join(', ')} UTC</>}
            </p>
          </div>
          <div>
            <h3 className="text-[11px] font-medium text-white/30 mb-1">Flagship post</h3>
            <button
              onClick={() => setActiveSubTab('feed')}
              className="text-left w-full border border-white/[0.05] rounded-lg p-2.5 bg-[#0e0e0e] hover:border-white/[0.12] transition-colors"
            >
              <p className="text-[12px] text-white/60">{synthesis.flagshipPost.excerpt}</p>
              <p className="text-[10px] text-white/20 font-mono mt-1">
                {formatTokens(synthesis.flagshipPost.metrics.likes)} likes · {formatTokens(synthesis.flagshipPost.metrics.reposts)} reposts · view in Feed →
              </p>
            </button>
          </div>
          <p className="text-[10px] text-white/12 font-mono">
            Synthesized {new Date(synthesis.synthesizedAt).toLocaleString()} · {synthesis.model}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-white/15">No character profile yet — generate one from gathered posts.</p>
      )}
    </div>
  )
}

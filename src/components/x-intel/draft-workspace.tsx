import { useState } from 'react'
import { useXIntelStore } from '../../stores/x-intel-store'
import { generateDraft } from '../../lib/x-intel/draft'
import { generateId } from '../../lib/utils'

export function DraftWorkspace() {
  const activeTarget = useXIntelStore((s) => s.activeTarget)
  const report = useXIntelStore((s) => (s.activeTarget ? s.reports[s.activeTarget] : undefined))
  const updateReport = useXIntelStore((s) => s.updateReport)
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (!activeTarget || !report) {
    return <div className="flex items-center justify-center h-full text-[12px] text-white/15">No target selected</div>
  }

  const generate = async () => {
    if (!report.profile || report.posts.length === 0) {
      setError('Gather posts first')
      return
    }
    if (!instructions.trim()) {
      setError('Add instructions (e.g. "reply to their AI post, supportive, mention open source")')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const text = await generateDraft(report.profile, report.posts, instructions, report.synthesisSettings)
      updateReport(activeTarget, {
        drafts: [{ id: generateId(), text, createdAt: new Date().toISOString() }, ...report.drafts],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft generation failed')
    } finally {
      setBusy(false)
    }
  }

  const editDraft = (id: string, text: string) => {
    updateReport(activeTarget, { drafts: report.drafts.map((d) => (d.id === id ? { ...d, text } : d)) })
  }

  const deleteDraft = (id: string) => {
    updateReport(activeTarget, { drafts: report.drafts.filter((d) => d.id !== id) })
  }

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-4 max-w-2xl">
      <div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={`Instructions — e.g. "Draft a supportive reply to @${activeTarget}'s latest post about AI, mention our open-source work, keep it under 200 chars"`}
          rows={3}
          className="w-full bg-[#0e0e0e] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white/70 outline-none focus:border-white/[0.12] transition-colors placeholder:text-white/15 resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={generate}
            disabled={busy}
            className="px-3 py-1 text-[11px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30"
          >
            {busy ? 'Drafting…' : 'Generate draft'}
          </button>
          {error && <span className="text-[11px] text-red-400/70">{error}</span>}
        </div>
      </div>

      <div className="space-y-2">
        {report.drafts.length === 0 ? (
          <p className="text-[11px] text-white/15">No drafts yet. Posting is out of scope — copy drafts to X manually.</p>
        ) : (
          report.drafts.map((d) => (
            <div key={d.id} className="border border-white/[0.05] rounded-lg p-3 bg-[#0e0e0e]">
              <textarea
                value={d.text}
                onChange={(e) => editDraft(d.id, e.target.value)}
                rows={Math.max(2, Math.ceil(d.text.length / 70))}
                className="w-full bg-transparent text-[12px] text-white/70 outline-none resize-none"
              />
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/20">
                <span className="font-mono">{d.text.length} chars</span>
                <span>{new Date(d.createdAt).toLocaleString()}</span>
                <div className="flex-1" />
                <button onClick={() => copy(d.id, d.text)} className="hover:text-white/50 transition-colors">
                  {copied === d.id ? 'Copied ✓' : 'Copy'}
                </button>
                <button onClick={() => deleteDraft(d.id)} className="hover:text-white/50 transition-colors">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

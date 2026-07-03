import { useState } from 'react'
import { useXAuthStore } from '../../stores/x-intel-auth-store'
import { useXIntelStore } from '../../stores/x-intel-store'
import { validateXKey } from '../../lib/x-intel/validate-x-key'
import { Modal, modalInputClass, modalGhostBtnClass, modalPrimaryBtnClass } from '../ui/modal'

export function XCredentialsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bearerToken, setBearerToken, clearBearerToken } = useXAuthStore()
  const seedTarget = useXIntelStore((s) => s.seedTarget)
  const [value, setValue] = useState(bearerToken ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleConnect = async () => {
    const token = value.trim()
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const validation = await validateXKey(token)
      if (!validation.ok) {
        setError(validation.message)
        return
      }
      setBearerToken(token)
      if (validation.profile) seedTarget(validation.profile)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save token')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="x-credentials-title">
      <div className="mb-6">
        <h2 id="x-credentials-title" className="text-[14px] font-semibold text-[var(--color-text-primary)]">Connect to X</h2>
        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
          Pay-per-use — credits deducted per request. Stored locally, never sent to third parties.
        </p>
      </div>

      <input
        type="password"
        value={value}
        onChange={(e) => { setValue(e.target.value); if (error) setError(null) }}
        placeholder="Bearer token (AAAA...)"
        className={`${modalInputClass} text-[13px] font-mono`}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) handleConnect()
          if (e.key === 'Escape') onClose()
        }}
      />
      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">
        Get a token at{' '}
        <a
          href="https://developer.x.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline underline-offset-2 transition-colors"
        >
          developer.x.com
        </a>
        {' '}(pay-per-use app, read scopes)
      </p>

      <div className="min-h-[1.5rem] mt-2" aria-live="polite">
        {error && <p role="alert" className="text-[11px] text-red-300 leading-snug">{error}</p>}
      </div>

      <div className="flex gap-2 mt-4 justify-end">
        {bearerToken && (
          <button
            type="button"
            onClick={() => { clearBearerToken(); setValue(''); setError(null) }}
            className={`${modalGhostBtnClass} text-[12px] hover:text-red-300`}
          >
            Disconnect
          </button>
        )}
        <button type="button" onClick={onClose} className={`${modalGhostBtnClass} text-[12px]`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConnect}
          disabled={!value.trim() || busy}
          aria-busy={busy || undefined}
          className={`${modalPrimaryBtnClass} text-[12px]`}
        >
          {busy ? '…' : 'Connect'}
        </button>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { useXAuthStore } from '../../stores/x-intel-auth-store'

export function XCredentialsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bearerToken, setBearerToken, clearBearerToken } = useXAuthStore()
  const [value, setValue] = useState(bearerToken ?? '')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#0e0e0e] border border-white/[0.08] rounded-xl p-6 w-full max-w-sm mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-[14px] font-semibold text-white/90">Connect to X</h2>
          <p className="text-[11px] text-white/25 mt-0.5">
            Pay-per-use — credits deducted per request. Stored locally, never sent to third parties.
          </p>
        </div>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Bearer token (AAAA...)"
          className="w-full bg-[#0a0a0a] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.15] transition-colors font-mono placeholder:text-white/10"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) { setBearerToken(value.trim()); onClose() }
            if (e.key === 'Escape') onClose()
          }}
        />
        <p className="text-[11px] text-white/15 mt-2">
          Get a token at{' '}
          <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/50 underline underline-offset-2 transition-colors">
            developer.x.com
          </a>
          {' '}(pay-per-use app, read scopes)
        </p>

        <div className="flex gap-2 mt-6 justify-end">
          {bearerToken && (
            <button onClick={() => { clearBearerToken(); setValue('') }} className="px-3 py-1.5 text-[12px] text-white/20 hover:text-white/40 transition-colors">
              Disconnect
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-white/30 hover:text-white/50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (value.trim()) { setBearerToken(value.trim()); onClose() } }}
            disabled={!value.trim()}
            className="px-4 py-1.5 text-[12px] font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}

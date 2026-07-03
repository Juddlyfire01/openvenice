import { useState } from 'react'
import { ImageView } from './image-view'
import { ImageTools } from './image-tools'
import { cn } from '../../lib/utils'

type ImageTab = 'generate' | 'tools'

export function ImagePage() {
  const [tab, setTab] = useState<ImageTab>('generate')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[var(--color-border-faint)]">
        {(['generate', 'tools'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'text-[14px] font-medium px-2.5 py-[3px] rounded-full transition-all duration-150',
              tab === t ? 'bg-[var(--color-accent-soft)] text-[var(--color-text-primary)] border border-[var(--color-accent)]/25' : 'bg-white/[0.03] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.05]',
            )}
          >
            {t === 'generate' ? 'Generate' : 'Edit / Upscale / BG Remove'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'generate' ? <ImageView /> : <ImageTools />}
      </div>
    </div>
  )
}

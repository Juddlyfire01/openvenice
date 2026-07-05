import { useComposeStore } from '../../stores/compose-store'
import { tweetLength } from '../../lib/compose/tweet-length'
import { TWEET_LIMIT, LONGFORM_LIMIT, type PostSegment } from '../../lib/compose/types'
import { CharRing } from './char-ring'
import { MediaAttachments } from './media-attachments'
import { PollEditor } from './poll-editor'

interface SegmentEditorProps {
  context: string
  segment: PostSegment
  index: number
  total: number
  longform: boolean
}

export function SegmentEditor({ context, segment, index, total, longform }: SegmentEditorProps) {
  const setSegmentText = useComposeStore((s) => s.setSegmentText)
  const removeSegment = useComposeStore((s) => s.removeSegment)
  const moveSegment = useComposeStore((s) => s.moveSegment)

  const limit = longform ? LONGFORM_LIMIT : TWEET_LIMIT
  const used = tweetLength(segment.text)

  return (
    <div className="border border-[var(--color-border-faint)] rounded-lg p-3 bg-[var(--color-bg-raised)] space-y-2">
      {total > 1 && (
        <div className="flex items-center gap-2 text-[10px] text-white/25">
          <span className="font-mono">{index + 1}/{total}</span>
          <div className="flex-1" />
          <button
            onClick={() => moveSegment(context, segment.id, -1)}
            disabled={index === 0}
            className="hover:text-white/60 transition-colors disabled:opacity-20"
          >
            ↑
          </button>
          <button
            onClick={() => moveSegment(context, segment.id, 1)}
            disabled={index === total - 1}
            className="hover:text-white/60 transition-colors disabled:opacity-20"
          >
            ↓
          </button>
          <button onClick={() => removeSegment(context, segment.id)} className="hover:text-red-400/70 transition-colors">
            Remove
          </button>
        </div>
      )}

      <textarea
        value={segment.text}
        onChange={(e) => setSegmentText(context, segment.id, e.target.value)}
        rows={Math.max(3, Math.ceil((segment.text.length || 1) / 60))}
        placeholder={index === 0 ? 'What do you want to post?' : 'Continue the thread…'}
        className="w-full bg-transparent text-[13px] text-white/85 outline-none resize-none placeholder:text-[var(--color-text-placeholder)]"
      />

      <MediaAttachments context={context} segment={segment} />
      <PollEditor context={context} segment={segment} />

      <div className="flex items-center justify-end pt-1">
        <CharRing used={used} limit={limit} />
      </div>
    </div>
  )
}

import { useState } from 'react'
import { venice } from '../../lib/venice-client'
import type { ChatCompletionResponse } from '../../types/venice'
import { Spinner } from '../ui/spinner'

const TLDR_MODEL = 'qwen3-next-80b'
const SCRAPE_MAX_CHARS = 6000

interface ScrapeResponse { url: string; content: string; format: string }

const cache = new Map<string, string>()

async function scrapeArticle(url: string): Promise<string | null> {
  try {
    const r = await venice<ScrapeResponse>('/augment/scrape', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
    const content = (r.content ?? '').trim()
    return content.length > 0 ? content.slice(0, SCRAPE_MAX_CHARS) : null
  } catch {
    return null
  }
}

async function summarize(source: string): Promise<string> {
  const res = await venice<ChatCompletionResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: TLDR_MODEL,
      messages: [
        { role: 'system', content: 'You summarize news articles into 2-3 short bullet points. Output only the bullets, each starting with "- ". No preamble.' },
        { role: 'user', content: source },
      ],
      temperature: 0.3,
      max_tokens: 220,
    }),
  })
  return res.choices?.[0]?.message?.content?.trim() ?? ''
}

export function Tldr({ url, excerpt }: { url: string; excerpt: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    cache.has(url) ? 'done' : 'idle',
  )
  const [text, setText] = useState(() => cache.get(url) ?? '')
  const [fromExcerpt, setFromExcerpt] = useState(false)

  async function run() {
    setState('loading')
    try {
      const scraped = await scrapeArticle(url)
      const usedExcerpt = scraped == null
      setFromExcerpt(usedExcerpt)
      const source = scraped ?? excerpt
      if (!source) { setState('error'); return }
      const summary = await summarize(source)
      if (!summary) { setState('error'); return }
      cache.set(url, summary)
      setText(summary)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={run}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/30 transition-colors"
      >
        TL;DR
      </button>
    )
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
        <Spinner size="xs" /> Summarizing…
      </div>
    )
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={run}
        className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
      >
        TL;DR unavailable — retry
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-base)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)] mb-1">
        TL;DR{fromExcerpt ? ' (based on excerpt)' : ''}
      </div>
      <div className="text-[12px] leading-relaxed text-[var(--color-text-primary)] whitespace-pre-line">
        {text}
      </div>
    </div>
  )
}

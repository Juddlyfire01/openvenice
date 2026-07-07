const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

export function stripHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input
  const slice = input.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

/** Small, stable, non-crypto hash (djb2) rendered base36 — stable IDs for React keys. */
export function hashId(url: string): string {
  let h = 5381
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function extractImageUrl(html: string | undefined): string | undefined {
  if (!html) return undefined
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m?.[1]
}

export function toIso(raw: string | undefined): string {
  if (!raw) return ''
  const t = Date.parse(raw)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}

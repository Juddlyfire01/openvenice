/**
 * Split a bio / free-text string into typed tokens so the UI can render URLs,
 * @mentions and #hashtags as interactive elements while leaving plain text alone.
 *
 * Kept framework-agnostic (returns data, not JSX) so it is unit-testable in
 * isolation. Rendering + safety (protocol allow-listing) is the caller's job.
 */
export type LinkToken =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string; href: string }
  | { type: 'mention'; value: string; username: string }
  | { type: 'hashtag'; value: string; tag: string }

// URLs (http/https), @handles (1–15 word chars, X's limit), #hashtags.
// Ordered alternation; matched left-to-right across the string.
const TOKEN_RE = /(https?:\/\/[^\s]+)|(?:^|(?<=[\s(]))@(\w{1,15})\b|(?:^|(?<=[\s(]))#(\w+)/g

export function linkify(text: string): LinkToken[] {
  const tokens: LinkToken[] = []
  let lastIndex = 0
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    // Emit any plain text preceding this match
    if (idx > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, idx) })

    if (m[1]) {
      // Trim common trailing punctuation that shouldn't be part of the URL
      const raw = m[1]
      const trimmed = raw.replace(/[.,;:!?)\]]+$/, '')
      const trailing = raw.slice(trimmed.length)
      tokens.push({ type: 'url', value: trimmed, href: trimmed })
      if (trailing) tokens.push({ type: 'text', value: trailing })
    } else if (m[2]) {
      tokens.push({ type: 'mention', value: `@${m[2]}`, username: m[2] })
    } else if (m[3]) {
      tokens.push({ type: 'hashtag', value: `#${m[3]}`, tag: m[3] })
    }
    lastIndex = idx + m[0].length
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) })
  return tokens
}
import type { VeniceModel } from '../../types/venice'

// Compose defaults to a Grok model with native X search so the assistant can
// research live X context while drafting. We resolve this from the live model
// list rather than hardcoding an id that may drift.

/**
 * Pick the default compose model: the first text model advertising
 * `supportsXSearch`, preferring an id containing "grok". Returns undefined when
 * no X-search-capable model is available (caller falls back to its default).
 */
export function pickComposeModel(models: VeniceModel[]): string | undefined {
  const xSearchCapable = models.filter((m) => m.model_spec?.capabilities?.supportsXSearch)
  if (xSearchCapable.length === 0) return undefined
  const grok = xSearchCapable.find((m) => m.id.toLowerCase().includes('grok'))
  return (grok ?? xSearchCapable[0]).id
}

/** Whether a given model id (from the loaded list) supports X search. */
export function modelSupportsXSearch(models: VeniceModel[], id: string): boolean {
  return Boolean(models.find((m) => m.id === id)?.model_spec?.capabilities?.supportsXSearch)
}

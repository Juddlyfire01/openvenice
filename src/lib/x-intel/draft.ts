import { venice } from '../venice-client'
import type { Profile, Post, SynthesisSettings } from './types'
import type { ChatCompletionResponse } from '../../types/venice'

const DRAFT_SYSTEM = `You are a social media ghostwriter. Given a target's recent posts, their character profile context, and the user's instructions, draft a post or reply. Match X conventions: under 280 characters unless instructed otherwise, no hashtag spam, natural voice per the user's instructions. Return ONLY the draft text — no preamble, no quotes, no commentary.`

export async function generateDraft(
  profile: Profile,
  posts: Post[],
  instructions: string,
  settings: SynthesisSettings,
): Promise<string> {
  const recent = posts
    .slice(0, Math.min(settings.contextCap, 30))
    .map((p) => `[${p.kind}] ${p.text}`)
    .join('\n')

  const resp = await venice<ChatCompletionResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      temperature: Math.max(settings.temperature, 0.5), // drafting wants more variety than analysis
      messages: [
        { role: 'system', content: DRAFT_SYSTEM },
        { role: 'user', content: `Target: @${profile.username} (${profile.displayName})\nBio: ${profile.bio ?? ''}\n\nRecent posts:\n${recent}\n\nInstructions: ${instructions}` },
      ],
    }),
  })

  const content = resp.choices[0].message.content
  return (typeof content === 'string' ? content : '').trim()
}

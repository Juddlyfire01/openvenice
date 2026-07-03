import { venice } from '../venice-client'
import type { Profile, Post, CharacterProfile, SynthesisSettings } from './types'
import type { ChatCompletionResponse } from '../../types/venice'

const SYNTHESIS_SYSTEM = `You are an intelligence analyst. Given a target's recent posts and profile, produce a structured character profile. Be specific and evidence-grounded. Cite post content. No fluff. No speculation beyond the given data.

Respond with ONLY a fenced json block matching exactly this shape:
\`\`\`json
{
  "themes": ["string"],
  "register": "string — tone/style description",
  "recurringTopics": [{ "topic": "string", "postCount": 0, "lastSeen": "ISO date" }],
  "postingCadence": { "pattern": "burst|steady", "peakWindowsUtc": ["HH:MM-HH:MM"], "avgPerDay": 0, "variance": "high|medium|low" },
  "flagshipPost": { "postId": "id of highest-engagement post", "excerpt": "first ~100 chars", "metrics": { "impressions": 0, "likes": 0, "reposts": 0, "replies": 0, "quotes": 0, "bookmarks": 0 } }
}
\`\`\``

export function parseSynthesis(content: string, model: string): CharacterProfile {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1] : content

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(jsonText.trim())
  } catch {
    throw new Error('Could not parse synthesis response — model did not return valid JSON')
  }

  const r = raw as {
    themes?: string[]
    register?: string
    recurringTopics?: CharacterProfile['recurringTopics']
    postingCadence?: CharacterProfile['postingCadence']
    flagshipPost?: CharacterProfile['flagshipPost']
  }

  if (!r.postingCadence || !r.flagshipPost) {
    throw new Error('Could not parse synthesis response — missing required fields')
  }

  return {
    themes: r.themes ?? [],
    register: r.register ?? '',
    recurringTopics: r.recurringTopics ?? [],
    postingCadence: r.postingCadence,
    flagshipPost: r.flagshipPost,
    synthesizedAt: new Date().toISOString(),
    model,
  }
}

export async function synthesizeProfile(
  profile: Profile,
  posts: Post[],
  settings: SynthesisSettings,
): Promise<CharacterProfile> {
  const transcript = posts
    .slice(0, settings.contextCap)
    .map((p) => `[${p.createdAt}] (${p.kind}, ${p.metrics.likes}L/${p.metrics.reposts}R, id:${p.id}) ${p.text}`)
    .join('\n')

  const resp = await venice<ChatCompletionResponse>('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      temperature: settings.temperature,
      messages: [
        { role: 'system', content: SYNTHESIS_SYSTEM },
        { role: 'user', content: `Profile: ${JSON.stringify(profile)}\n\nPosts:\n${transcript}` },
      ],
    }),
  })

  const content = resp.choices[0].message.content
  return parseSynthesis(typeof content === 'string' ? content : '', settings.model)
}

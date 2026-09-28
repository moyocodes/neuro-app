import Anthropic from '@anthropic-ai/sdk'

// Client-side only — no Cloud Function backend yet (deferred like the
// reminder push function). The API key ships in the browser bundle, so
// this is personal-use only. See README "AI goal suggestions".
const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

export async function suggestGoals(intent) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system:
      'You turn a vague self-improvement intent into concrete, daily-recitable ' +
      'goal statements. Each goal should be a short first-person affirmation ' +
      'or commitment (under 15 words), specific enough to act on daily. ' +
      'Return only a JSON array of 3-5 strings, nothing else.',
    messages: [{ role: 'user', content: intent }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) return []

  // Claude sometimes wraps the array in a ```json fence despite the
  // system prompt asking for raw JSON — strip fences before parsing.
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed.filter((g) => typeof g === 'string') : []
  } catch {
    return []
  }
}

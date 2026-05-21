import { buildGeneratePrompt, fetchResearchContext, makeAnthropicSSEStream, MAX_TOKENS_MAP } from '@/app/lib/prompts'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { topic, contentType, mood, agentMode, contentLength } = body

    if (!topic?.trim() || !contentType) {
      return Response.json({ error: 'Data tidak lengkap.' }, { status: 400 })
    }

    const researchContext = agentMode ? await fetchResearchContext(topic) : ''

    const prompt = buildGeneratePrompt({ topic, contentType, mood, contentLength, researchContext })
    const maxTokens = MAX_TOKENS_MAP[contentType] ?? 1024

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
        'accept':             'text/event-stream',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-7',
        max_tokens: maxTokens,
        stream:     true,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok || !anthropicRes.body) {
      return Response.json({ error: 'Anthropic API error' }, { status: 500 })
    }

    return new Response(makeAnthropicSSEStream(anthropicRes.body), {
      headers: {
        'Content-Type':            'text/plain; charset=utf-8',
        'Cache-Control':           'no-cache',
        'X-Content-Type-Options':  'nosniff',
      },
    })
  } catch (error) {
    console.error('Claude route error:', error)
    return Response.json({ error: 'Sistem lagi pusing!' }, { status: 500 })
  }
}

import { makeAnthropicSSEStream } from '@/app/lib/prompts'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { topic, contentType, mood, previousResult, feedback } = body

    if (!feedback?.trim() || !previousResult?.trim()) {
      return Response.json({ error: 'Data tidak lengkap.' }, { status: 400 })
    }

    const prompt = [
      'You are revising a piece of content based on user feedback. Your goal is to produce a better version that incorporates the feedback while keeping the same high quality and human voice.',
      '',
      'CRITICAL — LANGUAGE RULE: Respond in the SAME language as the original content. If the content is in Indonesian, respond in Indonesian. If English, respond in English. No switching.',
      '',
      'Original context:',
      `- Topic: ${topic}`,
      `- Content Type: ${contentType}`,
      ...(mood ? [`- Mood: ${mood}`] : []),
      '',
      'Previous content:',
      previousResult,
      '',
      'User revision request:',
      feedback,
      '',
      'Write a revised version that fully incorporates the feedback.',
      'Non-negotiable rules:',
      '- Plain text only — no markdown heading symbols (#)',
      "- Get straight to the point — no preamble, no 'Here is the revised version:' or any filler opening",
      '- Keep the same structure and format as the original unless the feedback explicitly asks to change it',
      '- Maintain the same high quality — every sentence must earn its place',
    ].join('\n')

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
        max_tokens: 4096,
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
    console.error('Revision error:', error)
    return Response.json({ error: 'Sistem lagi pusing!' }, { status: 500 })
  }
}

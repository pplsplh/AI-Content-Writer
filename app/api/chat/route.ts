export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages?.length) {
      return Response.json({ error: 'Messages required.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY ?? ''

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        stream: true,
        system: "You are Claude, a helpful and thoughtful assistant. Respond naturally and conversationally. Always match the language of the user's message — if they write in Indonesian, respond in Indonesian; if in English, respond in English; any other language — match it. Be concise unless the user asks for detail.",
        messages,
      }),
    })

    if (!anthropicRes.ok || !anthropicRes.body) {
      return Response.json({ error: 'Anthropic API error' }, { status: 500 })
    }

    const upstreamBody = anthropicRes.body
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamBody.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (
                  parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta.text
                ) {
                  controller.enqueue(new TextEncoder().encode(parsed.delta.text))
                }
              } catch {}
            }
          }
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error("Chat error:", error)
    return Response.json({ error: "Sistem lagi pusing!" }, { status: 500 })
  }
}

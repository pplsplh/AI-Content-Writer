import { buildGeneratePrompt, fetchResearchContext, MAX_TOKENS_MAP } from '@/app/lib/prompts'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { topic, contentType, mood, agentMode, contentLength } = body

    if (!topic?.trim() || !contentType) {
      return Response.json({ error: 'Data tidak lengkap.' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: 'API key Gemini belum dikonfigurasi.' }, { status: 500 })
    }

    const researchContext = agentMode ? await fetchResearchContext(topic) : ''
    const prompt          = buildGeneratePrompt({ topic, contentType, mood, contentLength, researchContext })
    const maxOutputTokens = MAX_TOKENS_MAP[contentType] ?? 1024

    const timeoutMs  = contentType === 'Artikel Blog' ? 60000 : 30000
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), timeoutMs)

    let geminiRes: Response
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents:         [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens },
          }),
          signal: controller.signal,
        },
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!geminiRes.ok) {
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return Response.json({ error: 'API key tidak valid, hubungi admin ya!' }, { status: 500 })
      }
      if (geminiRes.status === 429) {
        return Response.json({ error: 'Terlalu banyak request, tunggu sebentar dan coba lagi!' }, { status: 429 })
      }
      return Response.json({ error: 'Gemini lagi ngambek, coba lagi nanti!' }, { status: 500 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader     = geminiRes.body!.getReader()
        const decoder    = new TextDecoder()
        let lineBuffer   = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            lineBuffer += decoder.decode(value, { stream: true })
            const lines = lineBuffer.split('\n')
            lineBuffer  = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                const chunk = JSON.parse(jsonStr)
                const text  = chunk.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) controller.enqueue(new TextEncoder().encode(text))
              } catch {}
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type':            'text/plain; charset=utf-8',
        'Cache-Control':           'no-cache',
        'X-Content-Type-Options':  'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json({ error: 'Gemini kelamaan mikir, coba lagi nanti!' }, { status: 504 })
    }
    console.error('Gemini route error:', error)
    return Response.json({ error: 'Sistem lagi pusing!' }, { status: 500 })
  }
}

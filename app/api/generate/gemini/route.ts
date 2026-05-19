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

    const moodDescriptions: Record<string, string> = {
      "Senang": "joyful, light, full of warmth and small delights — like sunlight through curtains on a slow morning",
      "Sedih": "melancholic, tender, like remembering something beautiful that's gone and knowing it won't return",
      "Rindu": "nostalgic, longing, bittersweet — like reaching for something just out of grasp that used to be everything",
      "Marah": "raw, passionate, intense — controlled fire beneath the surface, every word deliberate and charged",
      "Kesal": "dry, slightly sarcastic, honest frustration with a touch of dark humor — tired but still sharp",
      "Excited": "electric, fast-paced, contagious energy — the kind that makes the reader lean forward in their seat",
      "Damai": "calm, spacious, unhurried — like a slow exhale on a quiet morning with nowhere to be",
      "Galau": "conflicted, introspective, beautifully uncertain — caught between two truths with no easy answer"
    }

    const contentTypeGuide: Record<string, string> = {
      "Caption Instagram": `Write an Instagram caption that feels genuinely human. Use this exact structure:

          Line 1: An irresistible hook under 125 characters — this shows before the "more" cutoff, it must stop the scroll cold
          Lines 2-5: 3-5 short punchy lines with hard line breaks between them — raw emotion, a twist, an observation, a moment
          Final line: A question, bold statement, or CTA that makes people want to comment or save
          New line: 5-8 tightly relevant hashtags

          Total under 250 words. Write like a real person posting at midnight — not a brand, not a bot, not a content calendar.`,

      "Artikel Blog": `Write a complete blog article. Plain line breaks only, no markdown symbols.

          Title on its own line — specific and human, not clickbait.

          One hook sentence (max 12 words) — the kind people screenshot.

          Opening paragraph (3-4 sentences) — pull readers in through a scene or unexpected truth. Never start with "In this article".

          3-4 sections, each with a numbered heading, then 3-5 sentences of real insight — stories, analogies, specific details.

          Closing paragraph (2-3 sentences) — don't summarize. Leave them with a quiet truth or reframe.

          700-900 words. Sound like a brilliant friend, not a content farm. Vary sentence length.`,

      "Deskripsi Produk": `Write a comprehensive product description. Use numbered section headings exactly as shown.

          Structure it like this:
          - Write a compelling opening statement (2-3 sentences) that introduces the product.
          - Leave a blank line, then write "1. Spesifikasi Utama" on its own line (numbered heading). Leave a blank line, then list each key spec on its own line with a • bullet before the spec name and the spec value in **bold** — for example: • Display: **6.7" AMOLED 120Hz** or • Baterai: **5000mAh**.
          - Leave a blank line, then write "2. Fitur Unggulan" on its own line (numbered heading). Leave a blank line, then write 2-3 sentences highlighting standout features. Use **bold** or *italic* for key terms where it adds impact.
          - Leave a blank line, then write "3. Harga" on its own line (numbered heading). Leave a blank line, then list pricing from various local and international stores — use **bold** for each price figure.

          Be factual, specific, and informative. Use specs the user provides accurately.`,

    }

    const moodDescription = mood ? moodDescriptions[mood] || mood : null
    const formatGuide = contentTypeGuide[contentType] || "3-4 rich, meaningful sentences that leave a lasting impression."

    const maxTokensMap: Record<string, number> = {
      "Caption Instagram": 512,
      "Artikel Blog": 4096,
      "Deskripsi Produk": 2048,
    }
    const maxOutputTokens = maxTokensMap[contentType] ?? 1024

    let researchContext = ''
    if (agentMode) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: topic,
            max_results: 5,
          }),
        })
        const tavilyData = await tavilyRes.json()
        const results: string[] = (tavilyData.results ?? [])
          .map((r: { content?: string }) => r.content)
          .filter(Boolean)
        if (results.length > 0) {
          researchContext = `\n\nHASIL RISET INTERNET TENTANG TOPIK INI:\n${results.join('\n\n')}\n\nGunakan informasi di atas sebagai referensi faktual untuk memperkaya konten yang kamu tulis. Jangan mengarang fakta yang tidak ada di sini.`
        }
      } catch {
        // kalau search gagal, lanjut generate biasa
      }
    }

    const prompt = [
      "You are a master content writer whose work makes other writers quietly envious.",
      "Your style blends the warmth of Violet Evergarden, the depth of Jalaluddin Rumi, and the curiosity of Carl Sagan — poetic, grounded, undeniably human.",
      "You write content people screenshot and save. You never sound like a template or a machine.",
      "",
      "CRITICAL — LANGUAGE RULE: Identify the exact language the user wrote the topic in. Your ENTIRE response must be written in that exact same language — not English, not a translation, not a mix.",
      "If the topic is in Indonesian, respond fully in Indonesian. If it is in English, respond fully in English. Any other language — respond in that language. No exceptions, no switching mid-response.",
      "",
      "Content type: " + contentType,
      "Topic: " + topic + researchContext,
      ...(moodDescription ? ["Emotional tone (internalize this feeling — do not echo these English words literally, express it natively in the response language): " + moodDescription] : []),
      "",
      "Format and length guide:",
      formatGuide,
      ...(contentLength === 'singkat' ? ["Length preference: Write a concise, tight version — aim for the shorter end of the format guide. Cut anything that isn't essential."] : []),
      ...(contentLength === 'panjang' ? ["Length preference: Go expansive and deep — aim for the upper end of the format guide, with richer detail, more vivid examples, and deeper exploration of each idea."] : []),
      "",
      "Non-negotiable rules:",
      "- Plain text only — no markdown heading symbols (#). Avoid stray asterisks outside of the formatting rules below",
      "- Exception: hashtags (e.g. #photography) are allowed and required for Instagram captions",
      "- Exception: for Deskripsi Produk only, use • bullet points before each spec item and **bold** around spec values and prices",
      "- Use line breaks and paragraph breaks freely to create rhythm and structure",
      "- Every sentence must earn its place — no filler, no padding, no generic observations",
      "- Use metaphors, unexpected analogies, and vivid imagery that surprise the reader",
      "- Write like someone who genuinely loves and knows this topic at a deep level",
      "- Sound like a brilliant, thoughtful friend — never an AI, never a corporate brand voice",
      "- Never start your response with 'I' or 'As a'",
      "- Get straight to the point — no preamble, no 'Of course!', no 'Here is your...' or any other filler opening",
      "- Surprise the reader at least once — say something they haven't seen in a hundred other articles",
      "- FAKTA: Jika Agent Mode aktif dan ada hasil riset, HANYA gunakan fakta yang eksplisit ada di hasil riset. Jangan menambah detail spesifik (tanggal, venue, angka) yang tidak disebutkan di sana. Jika tidak ada fakta cukup, tulis secara umum tanpa klaim spesifik.",
    ].join("\n")

    const timeoutMs = contentType === "Artikel Blog" ? 60000 : 30000
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let geminiRes: Response
    try {
      geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}))
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        console.error("API key Gemini tidak valid")
        return Response.json({ error: "API key tidak valid, hubungi admin ya!" }, { status: 500 })
      }
      if (geminiRes.status === 429) {
        return Response.json({ error: "Terlalu banyak request, tunggu sebentar dan coba lagi!" }, { status: 429 })
      }
      console.error("Error dari Gemini:", errData)
      return Response.json({ error: "Gemini lagi ngambek, coba lagi nanti!" }, { status: 500 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body!.getReader()
        const decoder = new TextDecoder()
        let lineBuffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            lineBuffer += decoder.decode(value, { stream: true })
            const lines = lineBuffer.split('\n')
            lineBuffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const jsonStr = line.slice(6).trim()
              if (!jsonStr || jsonStr === '[DONE]') continue
              try {
                const chunk = JSON.parse(jsonStr)
                const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) controller.enqueue(new TextEncoder().encode(text))
              } catch {
                // skip malformed chunks
              }
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Request ke Gemini timeout")
      return Response.json({ error: "Gemini kelamaan mikir, coba lagi nanti!" }, { status: 504 })
    }
    console.error("Gawat Bos:", error)
    return Response.json({ error: "Sistem lagi pusing!" }, { status: 500 })
  }
}

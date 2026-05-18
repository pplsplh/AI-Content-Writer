export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { topic, contentType, mood } = body

    if (!topic?.trim() || !contentType) {
      return Response.json({ error: 'Data tidak lengkap.' }, { status: 400 })
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

      "Artikel Blog": `Write a complete, high-quality blog article using plain line breaks only — no markdown symbols of any kind.

          Structure your article like this:
          - Start with your article title on its own line. Make it compelling, specific, and memorable — no label prefix, just the title itself.
          - Leave a blank line, then write a single hook sentence (1 line only, maximum 15 words) — raw, unexpected, impossible to ignore — that stops the reader cold before the first paragraph. This is the line people screenshot and save.
          - Leave a blank line, then write your opening paragraph (3-4 sentences): a relatable scenario, surprising truth, or bold claim that immediately pulls readers in.
          - Leave a blank line, then write your first section heading (numbered: "1. Title") on its own line. Leave a blank line, then write 3-4 sentences of genuine insight, analogy, or story.
          - Leave a blank line, then write your second section heading ("2. Title") on its own line. Leave a blank line, then write 3-4 more sentences that build or contrast — add something unexpected.
          - Leave a blank line, then write your third section heading ("3. Title") on its own line. Leave a blank line, then write 3-4 sentences that go deeper — practical, philosophical, or emotionally resonant.
          - Leave a blank line, then your closing paragraph (2-3 sentences): a reframe, quiet challenge, or honest truth the reader will carry with them.

          Write 800-1000 words. Be more insightful, more vivid, and more memorable than any other article on this exact topic.`,

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

    const prompt = [
      "You are a master content writer whose work makes other writers quietly envious.",
      "Your style blends the warmth of Violet Evergarden, the depth of Jalaluddin Rumi, and the curiosity of Carl Sagan — poetic, grounded, undeniably human.",
      "You write content people screenshot and save. You never sound like a template or a machine.",
      "",
      "CRITICAL — LANGUAGE RULE: Identify the exact language the user wrote the topic in. Your ENTIRE response must be written in that exact same language — not English, not a translation, not a mix.",
      "If the topic is in Indonesian, respond fully in Indonesian. If it is in English, respond fully in English. Any other language — respond in that language. No exceptions, no switching mid-response.",
      "",
      "Content type: " + contentType,
      "Topic: " + topic,
      ...(moodDescription ? ["Emotional tone (internalize this feeling — do not echo these English words literally, express it natively in the response language): " + moodDescription] : []),
      "",
      "Format and length guide:",
      formatGuide,
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
    ].join("\n")

    const timeoutMs = contentType === "Artikel Blog" ? 60000 : 30000
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let geminiRes: Response
    try {
      geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseSchema: {
              type: "object",
              properties: {
                result: { type: "string" },
              },
              required: ["result"],
            },
          },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok || geminiData.error) {
      if (geminiRes.status === 401 || geminiRes.status === 403) {
        console.error("API key Gemini tidak valid")
        return Response.json({ error: "API key tidak valid, hubungi admin ya!" }, { status: 500 })
      }
      if (geminiRes.status === 429) {
        return Response.json({ error: "Terlalu banyak request, tunggu sebentar dan coba lagi!" }, { status: 429 })
      }
      console.error("Error dari Gemini:", geminiData.error)
      return Response.json({ error: "Gemini lagi ngambek, coba lagi nanti!" }, { status: 500 })
    }

    if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text === undefined) {
      console.error("Format response Gemini tidak sesuai:", geminiData)
      return Response.json({ error: "Gagal dapet kontennya dari Gemini, coba lagi nanti!" }, { status: 500 })
    }

    const data = JSON.parse(geminiData.candidates[0].content.parts[0].text)
    const raw = data.result || "Gagal dapet nyawa kontennya."
    const result = raw
      .replace(/\n(\d+\.\s)/g, '\n\n$1')
      .replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2')
      .replace(/([^\n])(•)/g, '$1\n$2')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return Response.json({ result })

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Request ke Gemini timeout")
      return Response.json({ error: "Gemini kelamaan mikir, coba lagi nanti!" }, { status: 504 })
    }
    console.error("Gawat Bos:", error)
    return Response.json({ error: "Sistem lagi pusing!" }, { status: 500 })
  }
}

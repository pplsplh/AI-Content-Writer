export async function POST(req: Request) {
  try {
    const { topic, contentType } = await req.json();

    // 1. Gemini - Draft Cerdas
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Berikan hasil ${contentType} tentang "${topic}". Gunakan gaya bahasa lo sendiri—santai, puitis, dan sedikit filosofis kayak lagi ngobrol sama temen. Jangan pake gaya asisten robot!` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: "object",
            properties: {
              result: {
                type: "string",
              },
            },
            required: ["result"],
          },
        }
      })
    });
    const geminiData = await geminiRes.json();

    // error handling
    if (geminiData.error) {
      console.error("Error dari Gemini:", geminiData.error);
      return Response.json({ error: "Gemini lagi ngambek, coba lagi nanti!" }, { status: 500 });
    }

    if(geminiData.candidates?.[0]?.content?.parts?.[0]?.text === undefined) {
      console.error("Format response Gemini tidak sesuai:", geminiData);
      return Response.json({ error: "Gagal dapet kontennya dari Gemini, coba lagi nanti!" }, { status: 500 });
    }

    const data = JSON.parse(geminiData.candidates[0].content.parts[0].text);

    const result = data.result || "Gagal dapet nyawa kontennya.";

    return Response.json({ result });

  } catch (error) {
    console.error("Gawat Bos:", error);
    return Response.json({ error: "Sistem lagi pusing!" }, { status: 500 });
  }
}
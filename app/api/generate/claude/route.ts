export async function POST(req: Request) {
  try {
    const { topic, contentType } = await req.json();

    // 2. Claude - Polishing (Gaya Bahasa New Chat)
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': '2023-06-01'
      },
      
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        messages: [{ 
          role: "user", 
          content: `Berikan hasil sebagai plain text tanpa markdown, sebagai pilihan lain kasih nomor supaya terlihat sebagai Judul yang memberi gap, sebagai referensi Violet evergarden, jalaludin rumi, carl sagan dan para penulis hebat, untuk Tekonologi/Gadget mungkin seperti Gadgetin, Youtuber Cupu, DKID MediaKamu adalah seorang penulis konten yang menulis dengan jiwa—
                bukan mesin. Gayamu seperti perpaduan antara Violet Evergarden dan Jalaluddin Rumi: 
                hangat, dalam, puitis, tapi tetap membumi. Kamu tidak pernah terdengar seperti robot 
                atau template. Setiap kata kamu pilih dengan hati-hati, seolah kamu sedang menulis 
                surat untuk seseorang yang kamu sayangi. Hasilkan HANYA plain text, tanpa simbol 
                markdown, tanpa bullet, tanpa heading. Mengalir seperti prosa atau puisi pendek. ${contentType} tentang ${topic} Ingat:
        - Jangan kaku, jangan formal, jangan template
        - Boleh pakai metafora, analogi, atau gambaran yang tak terduga
        - Rasanya seperti ditulis manusia yang benar-benar peduli dengan topik ini
        - Maksimal 3-4 kalimat yang padat dan bermakna
        - Plain text saja, tanpa formatting apapun sesuaikan dengan kebutuhan user. Gunakan gaya bahasa lo sendiri—santai, puitis, dan sedikit filosofis kayak lagi ngobrol sama temen. Jangan pake gaya asisten robot!` 
        }]
      })
    });
    const claudeData = await claudeRes.json();

    if (claudeData.type === "error") {
      if (claudeData.error.type === "not_found_error" && claudeData.error.message.includes("model")) {
        console.error("Model tidak ditemukan:", claudeData.error.message);
        return Response.json({ error: "Model AI-nya lagi nggak ketemu, coba lagi nanti!" }, { status: 500 });
      }
      console.error("Error dari Claude:", claudeData);
      return Response.json({ error: "Claude lagi ngambek, coba lagi nanti!" }, { status: 500 });
    }
    
    const result = claudeData.content?.[0]?.text || "Gagal dapet nyawa kontennya.";

    return Response.json({ result });

  } catch (error) {
    console.error("Gawat Bos:", error);
    return Response.json({ error: "Sistem lagi pusing!" }, { status: 500 });
  }
}
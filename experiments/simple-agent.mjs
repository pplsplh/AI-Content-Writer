import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// 1. DEFINISI TOOLS
// ============================================
const tools = [
  {
    name: "calculator",
    description: "Hitung operasi matematika. Input berupa string ekspresi math.",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Ekspresi matematika, contoh: '25 * 4 + 10'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "count_words",
    description: "Hitung jumlah kata dalam sebuah teks.",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Teks yang mau dihitung katanya.",
        },
      },
      required: ["text"],
    },
  },
];

// ============================================
// 2. EKSEKUSI TOOLS (ini bagian kamu, bukan LLM)
// ============================================
function executeTool(toolName, toolInput) {
  if (toolName === "calculator") {
    try {
      const result = eval(toolInput.expression); // simple aja dulu
      return `Hasil: ${result}`;
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }

  if (toolName === "count_words") {
    const count = toolInput.text.trim().split(/\s+/).length;
    return `Jumlah kata: ${count}`;
  }

  return "Tool tidak ditemukan.";
}

// ============================================
// 3. AGENT LOOP
// ============================================
async function runAgent(userMessage) {
  console.log("\n=== AGENT START ===");
  console.log("User:", userMessage);

  const messages = [{ role: "user", content: userMessage }];

  // Loop maksimal 10 iterasi (stopping condition)
  for (let i = 0; i < 10; i++) {
    console.log(`\n--- Loop ${i + 1} ---`);

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });

    console.log("Stop reason:", response.stop_reason);

    // Kalau Claude sudah selesai (tidak butuh tool lagi)
    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log("\n=== FINAL ANSWER ===");
      console.log(finalText);
      return finalText;
    }

    // Kalau Claude minta pakai tool
    if (response.stop_reason === "tool_use") {
      // Tambah response Claude ke history
      messages.push({ role: "assistant", content: response.content });

      // Proses semua tool yang diminta
      const toolResults = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`Tool dipanggil: ${block.name}`);
          console.log(`Input:`, block.input);

          const result = executeTool(block.name, block.input);
          console.log(`Result:`, result);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Kembalikan hasil tool ke Claude
      messages.push({ role: "user", content: toolResults });
    }
  }

  return "Max loop reached.";
}

// ============================================
// 4. TEST
// ============================================
runAgent("Berapa hasil dari 125 * 8? Dan hitung juga berapa kata di kalimat ini: 'Saya sedang belajar membuat AI Agent dengan Claude API'");
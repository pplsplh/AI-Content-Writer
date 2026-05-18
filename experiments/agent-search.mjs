import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// TOOLS
// ============================================
const tools = [
  {
    name: "search_web",
    description: "Cari informasi terbaru dari internet berdasarkan query.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Kata kunci pencarian, contoh: 'harga iPhone 15 2024'",
        },
      },
      required: ["query"],
    },
  },
];

// ============================================
// EKSEKUSI TOOL
// ============================================
async function executeTool(toolName, toolInput) {
  if (toolName === "search_web") {
    const query = encodeURIComponent(toolInput.query);
    const url = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`;

    const res = await fetch(url);
    const data = await res.json();

    // Ambil abstract (ringkasan)
    if (data.AbstractText) {
      return data.AbstractText;
    }

    // Kalau tidak ada abstract, ambil dari RelatedTopics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const results = data.RelatedTopics
        .slice(0, 3)
        .filter(t => t.Text)
        .map(t => t.Text)
        .join("\n\n");
      return results || "Tidak ada hasil ditemukan.";
    }

    return "Tidak ada hasil ditemukan.";
  }

  return "Tool tidak ditemukan.";
}

// ============================================
// AGENT LOOP
// ============================================
async function runAgent(userMessage) {
  console.log("\n=== AGENT START ===");
  console.log("User:", userMessage);

  const messages = [{ role: "user", content: userMessage }];

  for (let i = 0; i < 10; i++) {
    console.log(`\n--- Loop ${i + 1} ---`);

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });

    console.log("Stop reason:", response.stop_reason);

    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log("\n=== FINAL ANSWER ===");
      console.log(finalText);
      return finalText;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`Tool dipanggil: ${block.name}`);
          console.log(`Query:`, block.input.query);

          const result = await executeTool(block.name, block.input);
          console.log(`Result:`, result.substring(0, 100) + "...");

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }

  return "Max loop reached.";
}

// ============================================
// TEST
// ============================================
runAgent("apa itu MCP di Anthropic claude?");
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

const server = new McpServer({
  name: "my-first-mcp",
  version: "1.0.0",
});

// ============================================
// TOOL 1: baca_file
// ============================================
server.tool(
  "baca_file",
  "Baca isi file dari komputer berdasarkan path.",
  {
    path: z.string().describe("Path file yang mau dibaca, contoh: ./README.md"),
  },
  async ({ path: filePath }) => {
    try {
      const isi = fs.readFileSync(filePath, "utf-8");
      return {
        content: [{ type: "text", text: isi }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

// ============================================
// TOOL 2: tulis_file
// ============================================
server.tool(
  "tulis_file",
  "Tulis atau buat file baru di komputer.",
  {
    path: z.string().describe("Path file yang mau ditulis, contoh: ./output.txt"),
    konten: z.string().describe("Isi konten yang mau ditulis ke file."),
  },
  async ({ path: filePath, konten }) => {
    try {
      fs.writeFileSync(filePath, konten, "utf-8");
      return {
        content: [{ type: "text", text: `File berhasil ditulis: ${filePath}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

// ============================================
// TOOL 3: list_files
// ============================================
server.tool(
  "list_files",
  "Lihat semua file dan folder di dalam sebuah direktori.",
  {
    folder: z.string().describe("Path folder yang mau dilihat, contoh: ./app"),
  },
  async ({ folder }) => {
    try {
      const items = fs.readdirSync(folder, { withFileTypes: true });
      const hasil = items.map((item) => {
        const tipe = item.isDirectory() ? "📁" : "📄";
        return `${tipe} ${item.name}`;
      });
      return {
        content: [{ type: "text", text: hasil.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

// ============================================
// JALANKAN SERVER
// ============================================
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Server jalan! Tools: baca_file, tulis_file, list_files");

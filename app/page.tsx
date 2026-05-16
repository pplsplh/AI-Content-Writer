'use client'
import { useState } from 'react'

export default function Home() {
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState('Caption Instagram')
  const [aiModel, setAiModel] = useState('claude')
  const [error, seterror ] = useState ( null )
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (!topic) return alert('Isi topik dulu ya!')
    setLoading(true)
    setResult('')
    seterror(null)
    const res = await fetch('/api/generate/' + aiModel, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, contentType })
    })
    const data = await res.json();
    if (data.error) {
      seterror(data.error)
    } else {
      setResult(data.result)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">AI Content Writer</h1>
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Pilih AI</label>
            <div className="flex gap-3">
              <button onClick={() => setAiModel('claude')} className={`flex-1 p-3 rounded-lg font-semibold border-2 ${aiModel === 'claude' ? 'border-purple-500 bg-purple-900' : 'border-gray-700 bg-gray-800'}`}>
                Claude
              </button>
              <button onClick={() => setAiModel('gemini')} className={`flex-1 p-3 rounded-lg font-semibold border-2 ${aiModel === 'gemini' ? 'border-blue-500 bg-blue-900' : 'border-gray-700 bg-gray-800'}`}>
                Gemini
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Jenis Konten</label>
            <select className="w-full bg-gray-800 rounded-lg p-3 text-white" value={contentType} onChange={e => setContentType(e.target.value)}>
              <option>Caption Instagram</option>
              <option>Artikel Blog</option>
              <option>Deskripsi Produk</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Topik / Kata Kunci</label>
            <textarea 
            value={topic} 
            onChange={(e) => setTopic(e.target.value)} // Biar apa yang lo ketik kesimpen di variabel 'topic'
            placeholder="Contoh: Kopi di bawah langit malam..."
            className="w-full p-4 bg-sky-950/50 border border-sky-500/30 rounded-xl text-white focus:ring-2 focus:ring-sky-400 outline-none"
            />
          </div>
          <button
            onClick={generate} // Ini wajib ada biar pas diklik fungsinya jalan
            disabled={loading} // Biar user nggak klik berkali-kali pas lagi nunggu
             className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20"
> 
            {loading ? 'Sabar, Duo AI lagi diskusi...' : 'Generate Content ✨'}
          </button>
          {error && (
            <div className="bg-red-700 rounded-lg p-4">
              <h2 className="font-semibold mb-2 text-white">Error:</h2>
              <p className="whitespace-pre-wrap text-red-100">{error}</p>
            </div>
          )}
          {result && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-2 text-purple-400">Hasil:</h2>
              <p className="whitespace-pre-wrap text-gray-200">{result}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
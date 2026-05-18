'use client'
import { useState } from 'react'

const CONTENT_TYPES = ['Caption Instagram', 'Artikel Blog', 'Deskripsi Produk']

const MOODS = [
  { label: 'Senang',   emoji: '😊', value: 'joyful and uplifting'       },
  { label: 'Sedih',    emoji: '😢', value: 'melancholic and heartfelt'   },
  { label: 'Rindu',    emoji: '💭', value: 'nostalgic and longing'       },
  { label: 'Marah',    emoji: '😤', value: 'fierce and passionate'       },
  { label: 'Kesal',    emoji: '😒', value: 'frustrated and blunt'        },
  { label: 'Excited',  emoji: '🤩', value: 'energetic and enthusiastic'  },
  { label: 'Damai',    emoji: '💫', value: 'calm and serene'             },
  { label: 'Galau',    emoji: '😰', value: 'conflicted and emotional'    },
]

const EXAMPLE_TOPICS = [
  'Kopi di bawah langit malam yang tenang',
  'Sepatu lama yang menemani perjalanan panjang',
  'Produk skincare natural untuk kulit sensitif',
  'Cara memulai kebiasaan membaca setiap hari',
  'Momen pagi hari sebelum dunia terbangun',
  'Hujan pertama setelah musim panas yang panjang',
]

const MAX_CHARS = 300

export default function Home() {
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState('Caption Instagram')
  const [mood, setMood] = useState<typeof MOODS[0] | null>(null)
  const [aiModel, setAiModel] = useState('claude')
  const [error, setError] = useState<string | null>(null)
  const [topicError, setTopicError] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)
  const [hasGenerated, setHasGenerated] = useState(false)

  async function generate() {
    if (!topic.trim()) {
      setTopicError(true)
      return
    }
    setTopicError(false)
    setHasGenerated(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate/' + aiModel, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, contentType, mood: mood?.label ?? null }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data.result)
      }
    } catch {
      setError('Koneksi terputus. Periksa internet kamu dan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function handleTopicChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    if (val.length <= MAX_CHARS) {
      setTopic(val)
      if (val.trim()) setTopicError(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generate()
    }
  }

  function fillExample() {
    setTopic(EXAMPLE_TOPICS[exampleIdx % EXAMPLE_TOPICS.length])
    setExampleIdx(i => i + 1)
    setTopicError(false)
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Gagal menyalin teks. Coba salin manual ya.')
    }
  }

  function downloadResult() {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `konten-${contentType.toLowerCase().replace(/ /g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0

  function renderLineInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
      if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>)
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return parts.length > 0 ? parts : [text]
  }

  function renderInlineMarkdown(text: string): React.ReactNode[] {
    return text.split('\n').map((line, i) => {
      if (line.trim() === '') return <div key={i} className="h-3" />
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <p key={i} className="mt-7 first:mt-0 font-semibold text-white tracking-normal">
            {renderLineInline(line)}
          </p>
        )
      }
      return <p key={i}>{renderLineInline(line)}</p>
    })
  }

  const charCountColor =
    topic.length > 270 ? 'text-red-400' :
    topic.length > 220 ? 'text-amber-400' :
    'text-slate-600'

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex flex-col items-center justify-start px-4 py-16">
      {/* Background glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 bg-sky-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-indigo-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-sky-400 mb-3 px-3 py-1 rounded-full border border-sky-400/30 bg-sky-400/5">
            Powered by Claude &amp; Gemini
          </span>
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-3">
            AI Content Writer
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
              Buat konten kreatif yang berkesan dengan sentuhan magis AI. Pilih topik, jenis konten, dan mood-nya, lalu biarkan AI merangkai kata-kata yang memikat hati audiensmu.
          </p>
        </div>

        <div className={hasGenerated
          ? 'grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start'
          : 'flex justify-center'
        }>

          {/* Form Card */}
          <div className={`bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 space-y-6${!hasGenerated ? ' w-full max-w-lg' : ''}`}>

            {/* AI Model Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Pilih AI Model
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAiModel('claude')}
                  className={`relative flex items-center justify-center gap-2 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                    aiModel === 'claude'
                      ? 'border-purple-500/60 bg-purple-500/15 text-purple-300 shadow-lg shadow-purple-500/10'
                      : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
                  }`}
                >
                  <span className="text-lg">✦</span>
                  Claude
                  {aiModel === 'claude' && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-300" />
                  )}
                </button>
                <button
                  onClick={() => setAiModel('gemini')}
                  className={`relative flex items-center justify-center gap-2 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                    aiModel === 'gemini'
                      ? 'border-sky-500/60 bg-sky-500/15 text-sky-300 shadow-lg shadow-sky-500/10'
                      : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
                  }`}
                >
                  <span className="text-lg">◈</span>
                  Gemini
                  {aiModel === 'gemini' && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded bg-sky-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Type */}
            <div>
              <label className="pt-3 block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Jenis Konten
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    className={`p-3 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                      contentType === type
                        ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="pt-3 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Nuansa / Mood
                </label>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(prev => prev?.value === m.value ? null : m)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                      mood?.value === m.value
                        ? 'border-pink-500/60 bg-pink-500/15 text-pink-300'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
              {mood && (
                <button
                  onClick={() => setMood(null)}
                  className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition-colors duration-200"
                >
                  × Hapus pilihan mood
                </button>
              )}
            </div>

            {/* Topic Input */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="pt-3 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Topik / Kata Kunci
                </label>
                <div className="pt-3 flex items-center gap-3">
                  <button
                    onClick={fillExample}
                    className="text-xs text-slate-500 hover:text-sky-400 transition-colors duration-200 underline underline-offset-2"
                  >
                    Butuh inspirasi?
                  </button>
                  <span className={`text-xs font-mono transition-colors ${charCountColor}`}>
                    {topic.length}/{MAX_CHARS}
                  </span>
                </div>
              </div>
              <textarea
                value={topic}
                onChange={handleTopicChange}
                onKeyDown={handleKeyDown}
                placeholder="Contoh: Kopi di bawah langit malam..."
                rows={4}
                className={`w-full px-4 py-3.5 bg-white/[0.04] border rounded-xl text-white placeholder-slate-600 text-sm leading-relaxed resize-none transition-all duration-200 outline-none focus:bg-white/[0.06] focus:shadow-lg ${
                  topicError
                    ? 'border-red-500/60 focus:border-red-500/80 focus:shadow-red-500/5'
                    : 'border-white/10 focus:border-indigo-500/50 focus:shadow-indigo-500/5'
                }`}
              />
              <div className="flex items-center justify-between mt-2">
                {topicError ? (
                  <p className="text-xs text-red-400">Isi topik dulu sebelum generate ya.</p>
                ) : (
                  <span />
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generate}
              disabled={loading}
              className="relative w-full py-4 rounded-xl font-bold text-sm tracking-wide overflow-hidden transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-600 transition-all duration-300 group-hover:opacity-90" />
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center justify-center gap-2">
                <span>✦</span>
                Generate Content
              </span>
            </button>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
                <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Error</p>
                  <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0 border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  Coba Lagi
                </button>
              </div>
            )}

          </div>

          {/* Result Panel */}
          <div>

            {/* Empty state — only visible on desktop so mobile doesn't show a gap */}
            {!result && !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center min-h-[340px] border border-dashed border-white/[0.07] rounded-2xl gap-4 text-center p-8">
                <div className="w-12 h-12 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-700 text-xl">
                  ✦
                </div>
                <div>
                  <p className="text-slate-600 text-sm font-medium">Kontenmu akan muncul di sini</p>
                  <p className="text-slate-700 text-xs mt-1">Generate pertamamu tinggal satu klik lagi</p>
                </div>
              </div>
            )}

            {/* Loading skeleton — shown while waiting for first result */}
            {loading && !result && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="h-3 bg-white/5 rounded-full w-16" />
                  <div className="h-3 bg-white/5 rounded-full w-10" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/[0.06] rounded-full w-2/3" />
                  <div className="h-3 bg-white/5 rounded-full" />
                  <div className="h-3 bg-white/5 rounded-full w-4/5" />
                  <div className="h-3 bg-white/5 rounded-full w-1/2" />
                  <div className="h-5" />
                  <div className="h-3 bg-white/[0.07] rounded-full w-3/4" />
                  <div className="h-3 bg-white/5 rounded-full" />
                  <div className="h-3 bg-white/5 rounded-full w-5/6" />
                  <div className="h-3 bg-white/5 rounded-full w-2/3" />
                  <div className="h-5" />
                  <div className="h-3 bg-white/[0.07] rounded-full w-1/2" />
                  <div className="h-3 bg-white/5 rounded-full w-4/5" />
                  <div className="h-3 bg-white/5 rounded-full" />
                  <div className="h-3 bg-white/5 rounded-full w-3/4" />
                  <div className="h-3 bg-white/5 rounded-full w-2/5" />
                </div>
              </div>
            )}

            {/* Result card — stays visible during regeneration with overlay */}
            {result && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden sticky top-8 relative">

                {/* Regenerating overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-[#080b14]/80 z-10 flex flex-col items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
                    <svg className="animate-spin w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <p className="text-xs text-slate-400 font-medium">Sedang dirangkai ulang...</p>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Hasil
                    </span>
                    <span className="text-xs text-slate-600">{wordCount} kata</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadResult}
                      title="Unduh sebagai file teks"
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                    >
                      Unduh
                    </button>
                    <button
                      onClick={copyResult}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                        copied
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {copied ? '✓ Tersalin' : 'Salin'}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="p-6 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                    <div className="text-slate-100 text-[15px] leading-[1.9] font-[family-name:var(--font-lora)] tracking-wide">
                      {renderInlineMarkdown(result)}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#080b14] to-transparent pointer-events-none" />
                </div>

                <div className="px-5 pb-4 border-t border-white/5 pt-3">
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>↺</span>
                    Buat ulang dengan pengaturan yang sama
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs mt-8">
          AI Content Writer — dibuat dengan jiwa, bukan template.
        </p>
      </div>
    </main>
  )
}

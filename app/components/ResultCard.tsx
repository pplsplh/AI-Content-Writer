'use client'
import { useState, useRef, useEffect } from 'react'
import { renderInlineMarkdown, normalizeStreamedResult } from '@/app/lib/markdown'

type Props = {
  result: string
  model: 'claude' | 'gemini'
  contentType: string
  topic: string
  mood: string | null
  loading: boolean
  isStreaming: boolean
  isRegenerating: boolean
  onRegenerate: () => void
  onResultChange: (newResult: string, isFinal: boolean) => void
}

export default function ResultCard({
  result, model, contentType, topic, mood,
  loading, isStreaming, isRegenerating,
  onRegenerate, onResultChange,
}: Props) {
  const [copied, setCopied]         = useState(false)
  const [shareOpen, setShareOpen]   = useState(false)
  const [reviseOpen, setReviseOpen] = useState(false)
  const [feedback, setFeedback]     = useState('')
  const [isRevising, setIsRevising] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const shareRef    = useRef<HTMLDivElement>(null)
  const bufRef      = useRef('')
  const flushRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0
  const charCount = result.length

  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [result, isStreaming])

  useEffect(() => {
    if (!shareOpen) return
    function onPointerDown(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [shareOpen])

  async function copy(text = result) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  function download(format: 'txt' | 'md') {
    const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    const blob = new Blob([result], { type: mime })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `konten-${contentType.toLowerCase().replace(/ /g, '-')}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRevise() {
    if (!feedback.trim() || isRevising) return
    setIsRevising(true)
    setReviseError(null)
    bufRef.current = ''

    try {
      const res = await fetch('/api/generate/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, contentType, mood, previousResult: result, feedback }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Revisi gagal.')
      }
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bufRef.current += decoder.decode(value, { stream: true })
        if (flushRef.current === null) {
          flushRef.current = setTimeout(() => {
            flushRef.current = null
            onResultChange(normalizeStreamedResult(bufRef.current), false)
          }, 16)
        }
      }
      if (flushRef.current !== null) {
        clearTimeout(flushRef.current)
        flushRef.current = null
      }
      const final = normalizeStreamedResult(bufRef.current)
      onResultChange(final, true)
      setFeedback('')
      setReviseOpen(false)
    } catch (err) {
      setReviseError(err instanceof Error ? err.message : 'Koneksi terputus.')
    } finally {
      setIsRevising(false)
    }
  }

  const spinnerColor = model === 'claude' ? 'text-purple-400' : 'text-sky-400'
  const modelBadge   = model === 'claude'
    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
    : 'border-sky-500/40 bg-sky-500/10 text-sky-300'

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden sticky top-8 relative">

      {/* Regenerating overlay */}
      {(loading && isRegenerating) && (
        <div className="absolute inset-0 bg-[#080b14]/80 z-10 flex flex-col items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
          <svg className={`animate-spin w-6 h-6 ${spinnerColor}`} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-xs text-slate-400 font-medium">Sedang dirangkai ulang...</p>
        </div>
      )}

      {/* Revising overlay */}
      {isRevising && (
        <div className="absolute inset-0 bg-[#080b14]/80 z-10 flex flex-col items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
          <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-xs text-slate-400 font-medium">Sedang merevisi...</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${loading ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Hasil</span>
          <span className="text-xs text-slate-600">{wordCount} kata · {charCount} karakter</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${modelBadge}`}>
            {model === 'claude' ? '✦' : '◈'} {model}
          </span>
          <span className="text-[10px] text-slate-600 px-2 py-0.5 rounded-full border border-white/8 bg-white/[0.03]">
            {contentType}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => download('txt')}
            title="Unduh sebagai .txt"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
          >
            .txt
          </button>
          <button
            onClick={() => download('md')}
            title="Unduh sebagai .md"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
          >
            .md
          </button>

          {/* Share dropdown */}
          <div ref={shareRef} className="relative">
            <button
              onClick={() => setShareOpen(prev => !prev)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                shareOpen
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              Bagikan
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${shareOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {shareOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#0d1120] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 py-1">
                <button
                  onClick={() => { copy(); setShareOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors duration-150 text-left"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Salin Teks
                </button>
                <div className="h-px bg-white/[0.06] mx-3 my-1" />
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${contentType}: ${topic}\n\n${result}\n\n— dibuat dengan AI Content Writer`)}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors duration-150"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  Bagikan ke WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${contentType}: ${topic}\n\n— dibuat dengan AI Content Writer`)}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors duration-150"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Bagikan ke Twitter/X
                </a>
              </div>
            )}
          </div>

          <button
            onClick={() => copy()}
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

      {/* Content */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="p-6 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
        >
          <div className="text-slate-100 text-[15px] leading-[1.9] font-[family-name:var(--font-lora)] tracking-wide">
            {renderInlineMarkdown(result, isStreaming)}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-[#080b14] to-transparent pointer-events-none" />
      </div>

      {/* Footer actions */}
      <div className="px-5 pb-4 pt-3 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-4">
          <button
            onClick={onRegenerate}
            disabled={loading || isRevising}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>↺</span>
            Buat ulang
          </button>
          <button
            onClick={() => { setReviseOpen(v => !v); setReviseError(null) }}
            disabled={loading || isRevising}
            className={`text-xs transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-50 ${
              reviseOpen ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>✏</span>
            Revisi
          </button>
        </div>

        {reviseOpen && (
          <div className="space-y-2">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise() }
              }}
              placeholder="Contoh: buat lebih singkat, ganti tone jadi lebih santai, tambah contoh konkret..."
              rows={2}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-slate-600 text-xs leading-relaxed resize-none outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all duration-200"
            />
            {reviseError && (
              <p className="text-xs text-red-400">{reviseError}</p>
            )}
            <button
              onClick={handleRevise}
              disabled={!feedback.trim() || isRevising}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              Terapkan Revisi
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

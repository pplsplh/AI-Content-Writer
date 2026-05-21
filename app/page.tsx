'use client'
import { useState, useRef, useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import ResultCard from '@/app/components/ResultCard'
import HistoryPanel from '@/app/components/HistoryPanel'
import { MOODS, CONTENT_TYPES, EXAMPLE_TOPICS, AGENT_STEPS, MAX_CHARS, MAX_HISTORY, HISTORY_KEY, DRAFT_KEY } from '@/app/lib/constants'
import { normalizeStreamedResult, extractHashtags } from '@/app/lib/markdown'
import type { HistoryItem } from '@/app/lib/types'

function groupHistory(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const now = Date.now()
  const today: HistoryItem[] = [], yesterday: HistoryItem[] = [], older: HistoryItem[] = []
  items.forEach(item => {
    const diff = now - item.timestamp
    if (diff < 86_400_000)       today.push(item)
    else if (diff < 172_800_000) yesterday.push(item)
    else                         older.push(item)
  })
  return [
    ...(today.length     ? [{ label: 'Hari ini',   items: today     }] : []),
    ...(yesterday.length ? [{ label: 'Kemarin',    items: yesterday }] : []),
    ...(older.length     ? [{ label: 'Lebih lama', items: older     }] : []),
  ]
}

export default function Home() {
  const [topic,        setTopic]        = useState('')
  const [contentType,  setContentType]  = useState('Caption Instagram')
  const [mood,         setMood]         = useState<typeof MOODS[number] | null>(null)
  const [aiModel,      setAiModel]      = useState('claude')
  const [error,        setError]        = useState<string | null>(null)
  const [topicError,   setTopicError]   = useState(false)
  const [result,       setResult]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [isRegenerating,    setIsRegenerating]    = useState(false)
  const [exampleIdx,        setExampleIdx]        = useState(0)
  const [hasGenerated,      setHasGenerated]      = useState(false)
  const [agentMode,         setAgentMode]         = useState(false)
  const [isResearching,     setIsResearching]     = useState(false)
  const [agentStep,         setAgentStep]         = useState(0)
  const [isStreaming,       setIsStreaming]        = useState(false)
  const [history,           setHistory]           = useState<HistoryItem[]>([])
  const [historyOpen,       setHistoryOpen]       = useState(false)
  const [historyFilter,     setHistoryFilter]     = useState<'all' | 'favorites'>('all')
  const [savedToast,        setSavedToast]        = useState(false)
  const [contentLength,     setContentLength]     = useState<'singkat' | 'sedang' | 'panjang'>('sedang')
  const [compareMode,       setCompareMode]       = useState(false)
  const [compareResult,     setCompareResult]     = useState('')
  const [compareIsStreaming,    setCompareIsStreaming]    = useState(false)
  const [compareIsRegenerating, setCompareIsRegenerating] = useState(false)
  const [hashtags,      setHashtags]      = useState<string[]>([])
  const [hashtagsCopied, setHashtagsCopied] = useState(false)

  const bufferRef        = useRef('')
  const flushTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const compareBufferRef = useRef('')
  const compareFlushRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepTimersRef    = useRef<ReturnType<typeof setTimeout>[]>([])

  // Load history + draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const { topic: t, contentType: ct, moodLabel } = JSON.parse(draft)
        if (t)         setTopic(t)
        if (ct)        setContentType(ct)
        if (moodLabel) setMood(MOODS.find(m => m.label === moodLabel) ?? null)
      }
    } catch {}
  }, [])

  // Auto-save draft
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ topic, contentType, moodLabel: mood?.label ?? null }))
    } catch {}
  }, [topic, contentType, mood])

  function saveToHistory(finalResult: string, savedTopic: string, savedContentType: string, savedMood: string | null, savedAiModel: string) {
    const item: HistoryItem = {
      id:          Date.now().toString(),
      topic:       savedTopic,
      contentType: savedContentType,
      mood:        savedMood,
      aiModel:     savedAiModel,
      result:      finalResult,
      timestamp:   Date.now(),
    }
    setHistory(prev => {
      const updated = [item, ...prev].slice(0, MAX_HISTORY)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }

  function loadFromHistory(item: HistoryItem) {
    setTopic(item.topic)
    setContentType(item.contentType)
    setAiModel(item.aiModel)
    setMood(item.mood ? (MOODS.find(m => m.label === item.mood) ?? null) : null)
    setResult(item.result)
    setHasGenerated(true)
    setHistoryOpen(false)
  }

  function deleteHistoryItem(id: string) {
    setHistory(prev => {
      const updated = prev.filter(i => i.id !== id)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  function clearHistory() {
    setHistory([])
    try { localStorage.removeItem(HISTORY_KEY) } catch {}
  }

  function toggleFavorite(id: string) {
    setHistory(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch {}
      return updated
    })
  }

  async function copyHashtags() {
    try {
      await navigator.clipboard.writeText(hashtags.join(' '))
      setHashtagsCopied(true)
      setTimeout(() => setHashtagsCopied(false), 2000)
    } catch {}
  }

  async function streamModel(
    model: string,
    bufRef: MutableRefObject<string>,
    flushRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
    setRes: Dispatch<SetStateAction<string>>,
    onFirst: () => void,
    onStreamEnd: () => void,
  ): Promise<string> {
    bufRef.current = ''
    const requestBody = { topic, contentType, mood: mood?.label ?? null, agentMode, contentLength }
    const res = await fetch('/api/generate/' + model, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(requestBody),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Terjadi kesalahan.')
    }
    if (!res.body) return ''
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let first     = true
    let completed = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) { completed = true; break }
        bufRef.current += decoder.decode(value, { stream: true })
        if (first) { onFirst(); first = false }
        if (flushRef.current === null) {
          flushRef.current = setTimeout(() => {
            flushRef.current = null
            setRes(bufRef.current)
          }, 16)
        }
      }
    } finally {
      if (flushRef.current !== null) { clearTimeout(flushRef.current); flushRef.current = null }
      const final = normalizeStreamedResult(bufRef.current)
      setRes(final)
      onStreamEnd()
    }
    return completed ? normalizeStreamedResult(bufRef.current) : ''
  }

  async function doGenerate() {
    if (!topic.trim()) { setTopicError(true); return }
    setTopicError(false)
    setHasGenerated(true)
    setIsRegenerating(result !== '')
    if (compareMode) setCompareIsRegenerating(compareResult !== '')
    setLoading(true)
    setError(null)
    setHashtags([])
    if (agentMode) {
      setIsResearching(true)
      setAgentStep(1)
      stepTimersRef.current = [
        setTimeout(() => setAgentStep(2), 3000),
        setTimeout(() => setAgentStep(3), 7000),
      ]
    }
    const snap = { topic, contentType, mood: mood?.label ?? null, aiModel }

    function onFirst() {
      setIsRegenerating(false)
      setIsResearching(false)
      setAgentStep(0)
      stepTimersRef.current.forEach(clearTimeout)
      stepTimersRef.current = []
      setIsStreaming(true)
    }

    try {
      if (compareMode) {
        const [claudeFinal, geminiFinal] = await Promise.all([
          streamModel('claude', bufferRef, flushTimerRef, setResult, onFirst, () => setIsStreaming(false)),
          streamModel(
            'gemini', compareBufferRef, compareFlushRef, setCompareResult,
            () => { setCompareIsRegenerating(false); setCompareIsStreaming(true) },
            () => setCompareIsStreaming(false),
          ),
        ])
        if (claudeFinal.trim()) saveToHistory(claudeFinal, snap.topic, snap.contentType, snap.mood, 'claude')
        if (geminiFinal.trim()) saveToHistory(geminiFinal, snap.topic, snap.contentType, snap.mood, 'gemini')
        const src = claudeFinal || geminiFinal
        if (src && snap.contentType === 'Caption Instagram') setHashtags(extractHashtags(src))
      } else {
        const finalResult = await streamModel(snap.aiModel, bufferRef, flushTimerRef, setResult, onFirst, () => setIsStreaming(false))
        if (finalResult.trim()) {
          saveToHistory(finalResult, snap.topic, snap.contentType, snap.mood, snap.aiModel)
          if (snap.contentType === 'Caption Instagram') setHashtags(extractHashtags(finalResult))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi terputus. Periksa internet kamu dan coba lagi.')
    } finally {
      setLoading(false)
      setIsRegenerating(false)
      setIsResearching(false)
      setIsStreaming(false)
      setCompareIsStreaming(false)
      setCompareIsRegenerating(false)
      setAgentStep(0)
      stepTimersRef.current.forEach(clearTimeout)
      stepTimersRef.current = []
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doGenerate() }
  }

  function fillExample() {
    setTopic(EXAMPLE_TOPICS[exampleIdx % EXAMPLE_TOPICS.length])
    setExampleIdx(i => i + 1)
    setTopicError(false)
  }

  // ResultCard callbacks
  function handleResultChange(model: 'claude' | 'gemini') {
    return (newResult: string, isFinal: boolean) => {
      if (model === 'claude') setResult(newResult)
      else setCompareResult(newResult)
      if (isFinal) saveToHistory(newResult, topic, contentType, mood?.label ?? null, model)
    }
  }

  const charCountColor =
    topic.length > 270 ? 'text-red-400' :
    topic.length > 220 ? 'text-amber-400' :
    'text-slate-600'

  const groups = groupHistory(history)

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex flex-col items-center justify-start px-4 py-16">

      {/* Background glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-3xl animate-blob-1" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 w-96 h-96 bg-sky-500/25 rounded-full blur-3xl animate-blob-2" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl animate-blob-3" />
      </div>

      <div className="relative w-full max-w-7xl">

        {/* Nav buttons */}
        <Link
          href="/chat"
          className="fixed top-4 right-4 z-30 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3.5 py-2 rounded-xl border border-white/8 bg-[#0d1120]/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-200 backdrop-blur-md shadow-lg shadow-black/30"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </Link>
        <button
          onClick={() => setHistoryOpen(true)}
          className="fixed top-4 left-4 z-30 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3.5 py-2 rounded-xl border border-white/8 bg-[#0d1120]/80 hover:border-white/15 hover:bg-white/[0.07] transition-all duration-200 backdrop-blur-md shadow-lg shadow-black/30"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Riwayat
          {history.length > 0 && (
            <span className="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded-full text-[10px] leading-none">
              {history.length}
            </span>
          )}
        </button>

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

        <div className={
          hasGenerated
            ? compareMode
              ? 'grid grid-cols-1 lg:grid-cols-[2fr_3fr_3fr] gap-6 items-start'
              : 'grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start'
            : 'flex justify-center'
        }>

          {/* ── Form Card ── */}
          <div className={`bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 space-y-6${!hasGenerated ? ' w-full max-w-lg' : ''}${compareMode && hasGenerated ? ' self-stretch' : ''}`}>

            {/* AI Model Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Pilih AI Model
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['claude', 'gemini'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => !compareMode && setAiModel(m)}
                    className={`relative flex items-center justify-center gap-2 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                      compareMode || aiModel === m
                        ? m === 'claude'
                          ? 'border-purple-500/60 bg-purple-500/15 text-purple-300 shadow-lg shadow-purple-500/10'
                          : 'border-sky-500/60 bg-sky-500/15 text-sky-300 shadow-lg shadow-sky-500/10'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{m === 'claude' ? '✦' : '◈'}</span>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                    {(compareMode || aiModel === m) && (
                      <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${m === 'claude' ? 'bg-purple-300' : 'bg-sky-400 rounded'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            {[
              {
                label: 'Agent Mode',
                desc:  'Aktifkan kemampuan riset untuk hasil yang lebih faktual dan mendalam.',
                value: agentMode,
                onToggle: () => setAgentMode(v => !v),
                color: compareMode || aiModel === 'gemini' ? 'bg-sky-500' : 'bg-purple-600',
              },
              {
                label: 'Mode Perbandingan',
                desc:  'Generate Claude dan Gemini sekaligus, bandingkan hasilnya.',
                value: compareMode,
                onToggle: () => setCompareMode(v => !v),
                color: 'bg-violet-600',
              },
            ].map(({ label, desc, value, onToggle, color }) => (
              <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.03]">
                <div className="min-w-0 mr-4">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
                <button
                  onClick={onToggle}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 ${value ? color : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}

            {/* Content Type */}
            <div>
              <label className="pt-3 block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Jenis Konten
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CONTENT_TYPES.map(type => (
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
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mr-1">Panjang</span>
                {(['singkat', 'sedang', 'panjang'] as const).map(len => (
                  <button
                    key={len}
                    onClick={() => setContentLength(len)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      contentLength === len
                        ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/8 bg-white/[0.03] text-slate-500 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    {len.charAt(0).toUpperCase() + len.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood Selector */}
            <div>
              <label className="pt-3 block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Nuansa / Mood
              </label>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map(m => (
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
              {topicError && (
                <p className="mt-2 text-xs text-red-400">Isi topik dulu sebelum generate ya.</p>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={doGenerate}
              disabled={loading}
              className="relative w-full py-4 rounded-xl font-bold text-sm tracking-wide overflow-hidden transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-600 transition-all duration-300 group-hover:opacity-90 group-disabled:opacity-70" />
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sedang dibuat...
                  </>
                ) : (
                  <><span>✦</span> Generate Content</>
                )}
              </span>
            </button>

            {/* Agent step indicator */}
            {isResearching && agentStep > 0 && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 animate-pulse">
                <span>{AGENT_STEPS[agentStep]?.icon}</span>
                <span>{AGENT_STEPS[agentStep]?.text}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
                <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Error</p>
                  <p className="text-sm text-red-300 leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={doGenerate}
                  disabled={loading}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0 border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50"
                >
                  Coba Lagi
                </button>
              </div>
            )}

          </div>
          {/* ── End Form Card ── */}

          {/* ── Claude Result Panel ── */}
          <div>
            {!result && !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center min-h-[340px] border border-dashed border-white/[0.07] rounded-2xl gap-4 text-center p-8">
                <div className="w-12 h-12 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-700 text-xl">✦</div>
                <div>
                  <p className="text-slate-600 text-sm font-medium">Kontenmu akan muncul di sini</p>
                  <p className="text-slate-700 text-xs mt-1">Generate pertamamu tinggal satu klik lagi</p>
                </div>
              </div>
            )}

            {loading && !result && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-white/10" />
                  <div className="h-3 bg-white/5 rounded-full w-16" />
                  <div className="h-3 bg-white/5 rounded-full w-10" />
                </div>
                <div className="space-y-3">
                  {[2/3, 1, 4/5, 1/2, 0, 3/4, 1, 5/6, 2/3, 0, 1/2, 4/5, 1, 3/4].map((w, i) =>
                    w === 0
                      ? <div key={i} className="h-5" />
                      : <div key={i} className="h-3 bg-white/5 rounded-full" style={{ width: `${w * 100}%` }} />
                  )}
                </div>
              </div>
            )}

            {result && (
              <ResultCard
                result={result}
                model={compareMode ? 'claude' : (aiModel as 'claude' | 'gemini')}
                contentType={contentType}
                topic={topic}
                mood={mood?.label ?? null}
                loading={loading}
                isStreaming={isStreaming}
                isRegenerating={isRegenerating}
                onRegenerate={doGenerate}
                onResultChange={handleResultChange('claude')}
              />
            )}

            {/* Hashtag panel — Instagram only */}
            {contentType === 'Caption Instagram' && hashtags.length > 0 && (
              <div className="mt-3 bg-white/[0.02] border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600"># Hashtag</span>
                  <button
                    onClick={copyHashtags}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-all duration-200 ${
                      hashtagsCopied
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                        : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {hashtagsCopied ? '✓ Tersalin' : 'Salin Semua'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map(tag => (
                    <span key={tag} className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Gemini Compare Panel ── */}
          {compareMode && hasGenerated && (
            <div>
              {loading && !compareResult && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <div className="h-3 bg-white/5 rounded-full w-16" />
                    <div className="h-3 bg-white/5 rounded-full w-10" />
                  </div>
                  <div className="space-y-3">
                    {[2/3, 1, 4/5, 1/2, 0, 3/4, 1, 5/6].map((w, i) =>
                      w === 0
                        ? <div key={i} className="h-5" />
                        : <div key={i} className="h-3 bg-white/5 rounded-full" style={{ width: `${w * 100}%` }} />
                    )}
                  </div>
                </div>
              )}

              {compareResult && (
                <ResultCard
                  result={compareResult}
                  model="gemini"
                  contentType={contentType}
                  topic={topic}
                  mood={mood?.label ?? null}
                  loading={loading}
                  isStreaming={compareIsStreaming}
                  isRegenerating={compareIsRegenerating}
                  onRegenerate={doGenerate}
                  onResultChange={handleResultChange('gemini')}
                />
              )}
            </div>
          )}

        </div>

        <p className="text-center text-slate-700 text-xs mt-8">
          AI Content Writer — dibuat dengan jiwa, bukan template.
        </p>
      </div>

      {/* Save toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        savedToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2 bg-[#0d1120]/90 border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-full backdrop-blur-md shadow-2xl shadow-black/50 whitespace-nowrap">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Tersimpan ke riwayat
        </div>
      </div>

      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        groups={groups}
        historyFilter={historyFilter}
        onFilterChange={setHistoryFilter}
        onLoad={loadFromHistory}
        onDelete={deleteHistoryItem}
        onClearAll={clearHistory}
        onToggleFavorite={toggleFavorite}
      />

    </main>
  )
}

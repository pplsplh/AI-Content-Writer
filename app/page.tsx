'use client'
import { useState, useRef, useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'

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
const HISTORY_KEY = 'ai-content-writer-history'
const DRAFT_KEY  = 'ai-content-writer-draft'
const MAX_HISTORY = 20

const AGENT_STEPS = [
  null,
  { icon: '🔍', text: 'Sedang riset topik...' },
  { icon: '📚', text: 'Mengumpulkan referensi...' },
  { icon: '✍️', text: 'Menyusun draft...' },
] as const

type HistoryItem = {
  id: string
  topic: string
  contentType: string
  mood: string | null
  aiModel: string
  result: string
  timestamp: number
  favorite?: boolean
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\wÀ-žЀ-ӿ]+/g) ?? []
  return [...new Set(matches)]
}

function normalizeStreamedResult(text: string): string {
  return text
    .replace(/\n(\d+\.\s)/g, '\n\n$1')
    .replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2')
    .replace(/([^\n])(•)/g, '$1\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Baru saja'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  if (diff < 172_800_000) return 'Kemarin'
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function groupHistory(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const now = Date.now()
  const today: HistoryItem[] = []
  const yesterday: HistoryItem[] = []
  const older: HistoryItem[] = []
  items.forEach(item => {
    const diff = now - item.timestamp
    if (diff < 86_400_000) today.push(item)
    else if (diff < 172_800_000) yesterday.push(item)
    else older.push(item)
  })
  return [
    ...(today.length    ? [{ label: 'Hari ini',    items: today     }] : []),
    ...(yesterday.length ? [{ label: 'Kemarin',     items: yesterday }] : []),
    ...(older.length    ? [{ label: 'Lebih lama',  items: older     }] : []),
  ]
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' ').trim()
}

export default function Home() {
  const [topic, setTopic] = useState('')
  const [contentType, setContentType] = useState('Caption Instagram')
  const [mood, setMood] = useState<typeof MOODS[0] | null>(null)
  const [aiModel, setAiModel] = useState('claude')
  const [error, setError] = useState<string | null>(null)
  const [topicError, setTopicError] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [agentStep, setAgentStep] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [contentLength, setContentLength] = useState<'singkat' | 'sedang' | 'panjang'>('sedang')
  const [compareMode, setCompareMode] = useState(false)
  const [compareResult, setCompareResult] = useState('')
  const [compareIsStreaming, setCompareIsStreaming] = useState(false)
  const [compareIsRegenerating, setCompareIsRegenerating] = useState(false)
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagsCopied, setHashtagsCopied] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorites'>('all')
  const [compareShareOpen, setCompareShareOpen] = useState(false)

  const bufferRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const compareBufferRef = useRef('')
  const compareFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const compareScrollRef = useRef<HTMLDivElement>(null)
  const shareRef = useRef<HTMLDivElement>(null)
  const compareShareRef = useRef<HTMLDivElement>(null)

  // Load history + draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const { topic: t, contentType: ct, moodLabel } = JSON.parse(draft)
        if (t) setTopic(t)
        if (ct) setContentType(ct)
        if (moodLabel) setMood(MOODS.find(m => m.label === moodLabel) ?? null)
      }
    } catch {}
  }, [])

  // Auto-save draft whenever inputs change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        topic, contentType, moodLabel: mood?.label ?? null,
      }))
    } catch {}
  }, [topic, contentType, mood])

  // Auto-scroll result panel while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [result, isStreaming])

  useEffect(() => {
    if (compareIsStreaming && compareScrollRef.current) {
      compareScrollRef.current.scrollTop = compareScrollRef.current.scrollHeight
    }
  }, [compareResult, compareIsStreaming])

  // Close share dropdown on outside click
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

  useEffect(() => {
    if (!compareShareOpen) return
    function onPointerDown(e: MouseEvent) {
      if (compareShareRef.current && !compareShareRef.current.contains(e.target as Node)) {
        setCompareShareOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [compareShareOpen])

  // Lock body scroll and handle Escape when panel is open
  useEffect(() => {
    document.body.style.overflow = historyOpen ? 'hidden' : ''
    if (!historyOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setHistoryOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [historyOpen])

  function saveToHistory(
    finalResult: string,
    savedTopic: string,
    savedContentType: string,
    savedMood: string | null,
    savedAiModel: string,
  ) {
    const item: HistoryItem = {
      id: Date.now().toString(),
      topic: savedTopic,
      contentType: savedContentType,
      mood: savedMood,
      aiModel: savedAiModel,
      result: finalResult,
      timestamp: Date.now(),
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
      const updated = prev.filter(item => item.id !== id)
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
      const updated = prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item)
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

  async function generate() {
    if (!topic.trim()) {
      setTopicError(true)
      return
    }
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

    const snapshotTopic = topic
    const snapshotContentType = contentType
    const snapshotMood = mood?.label ?? null
    const requestBody = { topic, contentType, mood: mood?.label ?? null, agentMode, contentLength }

    async function streamModel(
      model: string,
      bufRef: MutableRefObject<string>,
      flushRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
      setRes: Dispatch<SetStateAction<string>>,
      onFirst: () => void,
      onStreamEnd: () => void,
    ): Promise<string> {
      bufRef.current = ''
      const res = await fetch('/api/generate/' + model, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Terjadi kesalahan.')
      }
      if (!res.body) return ''
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let first = true
      let streamCompleted = false
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { streamCompleted = true; break }
          const text = decoder.decode(value, { stream: true })
          bufRef.current += text
          if (first) { onFirst(); first = false }
          if (flushRef.current === null) {
            flushRef.current = setTimeout(() => {
              flushRef.current = null
              setRes(bufRef.current)
            }, 16)
          }
        }
      } finally {
        if (flushRef.current !== null) {
          clearTimeout(flushRef.current)
          flushRef.current = null
        }
        const final = normalizeStreamedResult(bufRef.current)
        setRes(final)
        onStreamEnd()
      }
      return streamCompleted ? normalizeStreamedResult(bufRef.current) : ''
    }

    try {
      if (compareMode) {
        const [claudeFinal, geminiFinal] = await Promise.all([
          streamModel(
            'claude', bufferRef, flushTimerRef, setResult,
            () => {
              setIsRegenerating(false)
              setIsResearching(false)
              setAgentStep(0)
              stepTimersRef.current.forEach(clearTimeout)
              stepTimersRef.current = []
              setIsStreaming(true)
            },
            () => setIsStreaming(false),
          ),
          streamModel(
            'gemini', compareBufferRef, compareFlushTimerRef, setCompareResult,
            () => { setCompareIsRegenerating(false); setCompareIsStreaming(true) },
            () => setCompareIsStreaming(false),
          ),
        ])
        if (claudeFinal.trim()) saveToHistory(claudeFinal, snapshotTopic, snapshotContentType, snapshotMood, 'claude')
        if (geminiFinal.trim()) saveToHistory(geminiFinal, snapshotTopic, snapshotContentType, snapshotMood, 'gemini')
        const src = claudeFinal || geminiFinal
        if (src && snapshotContentType === 'Caption Instagram') setHashtags(extractHashtags(src))
      } else {
        const finalResult = await streamModel(
          aiModel, bufferRef, flushTimerRef, setResult,
          () => {
            setIsRegenerating(false)
            setIsResearching(false)
            setAgentStep(0)
            stepTimersRef.current.forEach(clearTimeout)
            stepTimersRef.current = []
            setIsStreaming(true)
          },
          () => setIsStreaming(false),
        )
        if (finalResult.trim()) {
          saveToHistory(finalResult, snapshotTopic, snapshotContentType, snapshotMood, aiModel)
          if (snapshotContentType === 'Caption Instagram') setHashtags(extractHashtags(finalResult))
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

  function downloadResult(text: string, format: 'txt' | 'md' = 'txt') {
    const mimeType = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `konten-${contentType.toLowerCase().replace(/ /g, '-')}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0
  const charCount = result.length

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

  function renderInlineMarkdown(text: string, showCursor = false): React.ReactNode[] {
    const lines = text.split('\n')
    const cursorLineIdx = showCursor
      ? lines.reduce((acc, line, i) => (line.trim() ? i : acc), -1)
      : -1
    return lines.map((line, i) => {
      const cursor = i === cursorLineIdx
        ? <span key="cursor" className="animate-blink text-slate-400 select-none">|</span>
        : null
      if (line.trim() === '') return <div key={i} className="h-3" />
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <p key={i} className="mt-7 first:mt-0 font-semibold text-white tracking-normal">
            {renderLineInline(line)}{cursor}
          </p>
        )
      }
      return <p key={i}>{renderLineInline(line)}{cursor}</p>
    })
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

        {/* Riwayat button — fixed to left edge */}
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

          {/* Form Card */}
          <div className={`bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/40 space-y-6${!hasGenerated ? ' w-full max-w-lg' : ''}`}>

            {/* AI Model Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Pilih AI Model
              </label>
              {compareMode ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03]">
                  <span className="text-sm font-semibold text-purple-300">✦ Claude</span>
                  <span className="text-slate-600 text-xs">+</span>
                  <span className="text-sm font-semibold text-sky-300">◈ Gemini</span>
                  <span className="ml-auto text-[11px] text-slate-600">Keduanya aktif</span>
                </div>
              ) : (
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
              )}
            </div>

            {/* Agent Mode Toggle */}
            <div className="mt-4 flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.03]">
              <div>
                <p className="text-sm font-semibold text-white">Agent Mode</p>
                <p className="text-xs text-slate-400">Aktifkan kemampuan riset untuk hasil yang lebih faktual dan mendalam.</p>
              </div>
              <button
                onClick={() => setAgentMode(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                  agentMode
                    ? aiModel === 'gemini' ? 'bg-sky-500' : 'bg-purple-600'
                    : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${
                  agentMode ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Compare Mode Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.03]">
              <div>
                <p className="text-sm font-semibold text-white">Mode Perbandingan</p>
                <p className="text-xs text-slate-400">Generate Claude dan Gemini sekaligus, bandingkan hasilnya.</p>
              </div>
              <button
                onClick={() => setCompareMode(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${compareMode ? 'bg-violet-600' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${compareMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
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
                  <>
                    <span>✦</span>
                    Generate Content
                  </>
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

            {/* Empty state */}
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

            {/* Loading skeleton */}
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

            {/* Result card */}
            {result && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden sticky top-8 relative">

                {/* Regenerating overlay */}
                {loading && isRegenerating && (
                  <div className="absolute inset-0 bg-[#080b14]/80 z-10 flex flex-col items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
                    <svg className="animate-spin w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <p className="text-xs text-slate-400 font-medium">Sedang dirangkai ulang...</p>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${loading ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Hasil</span>
                    <span className="text-xs text-slate-600">{wordCount} kata · {charCount} karakter</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      aiModel === 'claude'
                        ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    }`}>
                      {aiModel === 'claude' ? '✦' : '◈'} {aiModel}
                    </span>
                    <span className="text-[10px] text-slate-600 px-2 py-0.5 rounded-full border border-white/8 bg-white/[0.03]">
                      {contentType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadResult(result, 'txt')}
                      title="Unduh sebagai .txt"
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                    >
                      .txt
                    </button>
                    <button
                      onClick={() => downloadResult(result, 'md')}
                      title="Unduh sebagai .md"
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                    >
                      .md
                    </button>
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
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${shareOpen ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {shareOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#0d1120] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 py-1">
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(result)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 2000)
                              } catch {}
                              setShareOpen(false)
                            }}
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
                            target="_blank"
                            rel="noopener noreferrer"
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
                            target="_blank"
                            rel="noopener noreferrer"
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
                  <div ref={scrollRef} className="p-6 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                    <div className="text-slate-100 text-[15px] leading-[1.9] font-[family-name:var(--font-lora)] tracking-wide">
                      {renderInlineMarkdown(result, isStreaming)}
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

          {/* Compare panel — Gemini result */}
          {compareMode && hasGenerated && (
            <div>
              {/* Loading skeleton for compare */}
              {loading && !compareResult && (
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
                  </div>
                </div>
              )}

              {compareResult && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden sticky top-8 relative">
                  {loading && compareIsRegenerating && (
                    <div className="absolute inset-0 bg-[#080b14]/80 z-10 flex flex-col items-center justify-center gap-3 rounded-xl backdrop-blur-[2px]">
                      <svg className="animate-spin w-6 h-6 text-sky-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <p className="text-xs text-slate-400 font-medium">Sedang dirangkai ulang...</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${loading ? 'animate-pulse' : ''}`} />
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Hasil</span>
                      <span className="text-xs text-slate-600">{compareResult.trim().split(/\s+/).length} kata</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-300">
                        ◈ gemini
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => downloadResult(compareResult, 'txt')}
                        title="Unduh sebagai .txt"
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                      >
                        .txt
                      </button>
                      <button
                        onClick={() => downloadResult(compareResult, 'md')}
                        title="Unduh sebagai .md"
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white transition-all duration-200"
                      >
                        .md
                      </button>
                      <div ref={compareShareRef} className="relative">
                        <button
                          onClick={() => setCompareShareOpen(prev => !prev)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                            compareShareOpen
                              ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
                              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          Bagikan
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${compareShareOpen ? 'rotate-180' : ''}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>

                        {compareShareOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#0d1120] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 py-1">
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(compareResult)
                                  setCopied(true)
                                  setTimeout(() => setCopied(false), 2000)
                                } catch {}
                                setCompareShareOpen(false)
                              }}
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
                              href={`https://wa.me/?text=${encodeURIComponent(`${contentType}: ${topic}\n\n${compareResult}\n\n— dibuat dengan AI Content Writer`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setCompareShareOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors duration-150"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                              </svg>
                              Bagikan ke WhatsApp
                            </a>
                            <a
                              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${contentType}: ${topic}\n\n— dibuat dengan AI Content Writer`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setCompareShareOpen(false)}
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
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(compareResult)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          } catch {}
                        }}
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
                    <div ref={compareScrollRef} className="p-6 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
                      <div className="text-slate-100 text-[15px] leading-[1.9] font-[family-name:var(--font-lora)] tracking-wide">
                        {renderInlineMarkdown(compareResult, compareIsStreaming)}
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
          )}

        </div>

        {/* Footer */}
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

      {/* History Panel Backdrop */}
      <div
        onClick={() => setHistoryOpen(false)}
        className={`fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300 ${
          historyOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* History Panel */}
      <div className={`fixed top-0 left-0 h-full w-[340px] bg-[#0d1120] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-[20px_0_60px_rgba(0,0,0,0.5)] ${
        historyOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>

        {/* Panel Header */}
        <div className="px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Riwayat Generasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">{history.length} item tersimpan · maks {MAX_HISTORY}</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all duration-200"
                >
                  Hapus Semua
                </button>
              )}
              <button
                onClick={() => setHistoryOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:border-white/20 transition-all duration-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'favorites'] as const).map(f => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  historyFilter === f
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? 'Semua' : '★ Favorit'}
              </button>
            ))}
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
          {(() => {
            const filteredGroups = historyFilter === 'favorites'
              ? groups.map(g => ({ ...g, items: g.items.filter(i => i.favorite) })).filter(g => g.items.length > 0)
              : groups
            const isEmpty = filteredGroups.length === 0
            return isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-16">
                <div className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-700">
                  {historyFilter === 'favorites' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )}
                </div>
                <p className="text-slate-600 text-sm">{historyFilter === 'favorites' ? 'Belum ada favorit' : 'Belum ada riwayat'}</p>
                <p className="text-slate-700 text-xs">{historyFilter === 'favorites' ? 'Bintangi hasil yang kamu suka' : 'Hasil generasimu akan muncul di sini'}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredGroups.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2 px-1">
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="relative group/card">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => loadFromHistory(item)}
                            onKeyDown={e => { if (e.key === 'Enter') loadFromHistory(item) }}
                            className="w-full text-left p-4 pr-9 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/15 hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-start gap-2 mb-1.5">
                              <span className={`shrink-0 mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                item.aiModel === 'claude'
                                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                                  : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                              }`}>
                                {item.aiModel === 'claude' ? '✦' : '◈'}
                              </span>
                              <span className="text-sm font-medium text-white leading-snug line-clamp-2">
                                {item.topic}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mb-2">
                              {stripMarkdown(item.result)}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/8">
                                {item.contentType}
                              </span>
                              {item.mood && (
                                <span className="text-[10px] text-pink-400/70">
                                  {MOODS.find(m => m.label === item.mood)?.emoji} {item.mood}
                                </span>
                              )}
                              <span className="ml-auto text-[10px] text-slate-700">
                                {formatTimestamp(item.timestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Favorite star */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleFavorite(item.id) }}
                            title={item.favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                            className={`absolute top-2 right-8 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 text-sm leading-none ${
                              item.favorite
                                ? 'text-amber-400 opacity-100'
                                : 'text-slate-600 opacity-0 group-hover/card:opacity-100 hover:text-amber-400'
                            }`}
                          >
                            {item.favorite ? '★' : '☆'}
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            title="Hapus dari riwayat"
                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md border border-white/8 bg-white/[0.04] text-slate-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover/card:opacity-100 text-base leading-none"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

      </div>

    </main>
  )
}

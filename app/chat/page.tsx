'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bufferRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setLoading(true)
    setStreamingContent('')
    bufferRef.current = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bufferRef.current += decoder.decode(value, { stream: true })
          if (flushTimerRef.current === null) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null
              setStreamingContent(bufferRef.current)
            }, 16)
          }
        }
      } finally {
        if (flushTimerRef.current !== null) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
        const final = bufferRef.current.trim()
        setStreamingContent('')
        setMessages(prev => [...prev, { role: 'assistant', content: final }])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Maaf, terjadi kesalahan. Coba lagi ya.' },
      ])
    } finally {
      setLoading(false)
      setStreamingContent('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex flex-col">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center gap-4 px-4 py-3.5 border-b border-white/8 bg-[#080b14]/80 backdrop-blur-md shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3.5 py-2 rounded-xl border border-white/8 bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.07] transition-all duration-200"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Kembali
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Chat</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300">
            ✦ Claude
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
        <div className="max-w-3xl mx-auto px-4 py-6 w-full">

          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="w-14 h-14 rounded-full border border-purple-500/30 bg-purple-500/5 flex items-center justify-center text-2xl text-purple-300">
                ✦
              </div>
              <div>
                <p className="text-white font-semibold text-lg mb-2">Halo! Aku Claude.</p>
                <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                  Tanya apa saja — ide konten, saran tulisan, pertanyaan umum, atau sekadar ngobrol santai.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {[
                  'Kasih ide caption Instagram tentang kopi',
                  'Jelaskan black hole dengan bahasa sederhana',
                  'Tulis pembukaan cerita pendek yang menarik',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                    className="text-xs text-slate-500 hover:text-slate-300 px-3.5 py-2 rounded-xl border border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full border border-purple-500/30 bg-purple-500/10 flex items-center justify-center text-xs text-purple-300 shrink-0 mt-0.5">
                    ✦
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/20 border border-indigo-500/25 text-white rounded-tr-sm'
                      : 'bg-white/[0.04] border border-white/10 text-slate-100 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming bubble */}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full border border-purple-500/30 bg-purple-500/10 flex items-center justify-center text-xs text-purple-300 shrink-0 mt-0.5">
                  ✦
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-white/[0.04] border border-white/10 text-slate-100 whitespace-pre-wrap">
                  {streamingContent || (
                    <span className="flex gap-1 items-center h-5">
                      <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="relative z-10 shrink-0 px-4 pb-6 pt-3 bg-[#080b14]/80 backdrop-blur-md border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); resizeTextarea() }}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesanmu... (Enter kirim, Shift+Enter baris baru)"
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-slate-600 text-sm leading-relaxed resize-none outline-none [&::-webkit-scrollbar]:hidden"
              style={{ minHeight: '24px', maxHeight: '128px' }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

'use client'
import { useEffect } from 'react'
import { MOODS, MAX_HISTORY } from '@/app/lib/constants'
import { stripMarkdown } from '@/app/lib/markdown'
import type { HistoryItem } from '@/app/lib/types'

type Group = { label: string; items: HistoryItem[] }

type Props = {
  isOpen: boolean
  onClose: () => void
  history: HistoryItem[]
  groups: Group[]
  historyFilter: 'all' | 'favorites'
  onFilterChange: (f: 'all' | 'favorites') => void
  onLoad: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onToggleFavorite: (id: string) => void
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)       return 'Baru saja'
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)} jam lalu`
  if (diff < 172_800_000)  return 'Kemarin'
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistoryPanel({
  isOpen, onClose, history, groups, historyFilter,
  onFilterChange, onLoad, onDelete, onClearAll, onToggleFavorite,
}: Props) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  const filteredGroups = historyFilter === 'favorites'
    ? groups.map(g => ({ ...g, items: g.items.filter(i => i.favorite) })).filter(g => g.items.length > 0)
    : groups

  const isEmpty = filteredGroups.length === 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div className={`fixed top-0 left-0 h-full w-[340px] bg-[#0d1120] border-r border-white/10 z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-[20px_0_60px_rgba(0,0,0,0.5)] ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Riwayat Generasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">{history.length} item tersimpan · maks {MAX_HISTORY}</p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all duration-200"
                >
                  Hapus Semua
                </button>
              )}
              <button
                onClick={onClose}
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
                onClick={() => onFilterChange(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  historyFilter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f === 'all' ? 'Semua' : '★ Favorit'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
          {isEmpty ? (
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
              <p className="text-slate-600 text-sm">
                {historyFilter === 'favorites' ? 'Belum ada favorit' : 'Belum ada riwayat'}
              </p>
              <p className="text-slate-700 text-xs">
                {historyFilter === 'favorites' ? 'Bintangi hasil yang kamu suka' : 'Hasil generasimu akan muncul di sini'}
              </p>
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
                          onClick={() => onLoad(item)}
                          onKeyDown={e => { if (e.key === 'Enter') onLoad(item) }}
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

                        {/* Favorite */}
                        <button
                          onClick={e => { e.stopPropagation(); onToggleFavorite(item.id) }}
                          title={item.favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                          className={`absolute top-2 right-8 w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 text-sm leading-none ${
                            item.favorite
                              ? 'text-amber-400 opacity-100'
                              : 'text-slate-600 opacity-0 group-hover/card:opacity-100 hover:text-amber-400'
                          }`}
                        >
                          {item.favorite ? '★' : '☆'}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDelete(item.id)}
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
          )}
        </div>

      </div>
    </>
  )
}

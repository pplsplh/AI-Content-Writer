import React from 'react'

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

export function renderInlineMarkdown(text: string, showCursor = false): React.ReactNode[] {
  const lines = text.split('\n')
  const cursorLineIdx = showCursor
    ? lines.reduce((acc, line, i) => (line.trim() ? i : acc), -1)
    : -1
  return lines.map((line, i) => {
    const cursor =
      i === cursorLineIdx ? (
        <span key="cursor" className="animate-blink text-slate-400 select-none">
          |
        </span>
      ) : null
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

export function normalizeStreamedResult(text: string): string {
  return text
    .replace(/\n(\d+\.\s)/g, '\n\n$1')
    .replace(/([^\n])(\d+\.\s)/g, '$1\n\n$2')
    .replace(/([^\n])(•)/g, '$1\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\wÀ-žЀ-ӿ]+/g) ?? []
  return [...new Set(matches)]
}

export function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n+/g, ' ').trim()
}

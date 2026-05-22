'use client'

import { useEffect, useRef, useState } from 'react'

interface ConsoleProps {
  lines: string[]
  onCommand: (command: string) => Promise<void>
}

export function Console({ lines, onCommand }: ConsoleProps) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || sending) return

    setSending(true)
    setHistory((h) => [cmd, ...h.slice(0, 49)])
    setHistoryIdx(-1)
    setInput('')

    try {
      await onCommand(cmd)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(next)
      setInput(history[next] ?? '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(historyIdx - 1, -1)
      setHistoryIdx(next)
      setInput(next === -1 ? '' : (history[next] ?? ''))
    }
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-zinc-700">Waiting for console output…</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="text-zinc-300 whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex items-center gap-2 border-t border-zinc-800 px-4 py-3"
      >
        <span className="text-amber-500 font-mono text-sm select-none">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter RCON command…"
          className="flex-1 bg-transparent font-mono text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="font-mono text-xs text-amber-500 hover:text-amber-400 disabled:text-zinc-700 transition-colors"
        >
          {sending ? 'sending…' : 'EXEC'}
        </button>
      </form>
    </div>
  )
}

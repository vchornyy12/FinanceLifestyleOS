'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STARTER_PROMPTS = [
  'Why did I overspend this month?',
  'What are my most expensive products from receipts?',
  'How is my savings rate trending?',
  'Which wallet has the highest balance?',
  'Give me a spending breakdown by category',
]

export default function ChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('chat_messages')
      .select('id, role, content')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages((data ?? []) as Message[])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    setError(null)
    setInput('')
    setStreaming(true)
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      })

      if (res.status === 429) {
        setError('Too many messages — try again later.')
        setStreaming(false)
        return
      }
      if (!res.ok || !res.body) {
        setError('Something went wrong. Please try again.')
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (controller.signal.aborted) {
          await reader.cancel()
          break
        }
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamingContent(full)
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: full },
      ])
      setStreamingContent('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-l border-mac-hairline bg-mac-surface">
      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center border-b border-mac-hairline px-4">
        <span className="text-[13px] font-semibold text-mac-label">AI Coach</span>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {loading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-mac-label/8" />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && !streaming && (
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-center text-xs text-mac-tertiary">
              Ask anything about your finances
            </p>
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-left text-xs text-mac-secondary transition-colors hover:border-mac-accent/50 hover:text-mac-label"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'ml-auto bg-mac-accent text-white'
                : 'bg-mac-elevated text-mac-label'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {streamingContent && (
          <div className="max-w-[90%] rounded-xl bg-mac-elevated px-3 py-2 text-sm text-mac-label">
            {streamingContent}
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-mac-tertiary" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-mac-hairline p-3">
        {error && (
          <p className="mb-2 text-xs text-mac-red">{error}</p>
        )}
        <div className="flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Ask about your finances…"
            className="flex-1 resize-none rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-mac-accent text-white transition-colors hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            {streaming ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}

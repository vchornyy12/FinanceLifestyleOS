# AI Chat Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed right-side AI chat panel to all dashboard pages, backed by NVIDIA NIM (DeepSeek v4 Pro), with full financial context injection and Supabase-persisted history.

**Architecture:** Server Route Handler (`POST /api/chat`) fetches financial context + chat history from Supabase, streams from NVIDIA NIM, persists both messages after stream ends. Client component reads the stream chunk-by-chunk and renders live.

**Tech Stack:** Next.js 16 App Router · `openai` npm package (OpenAI-compatible SDK) · Supabase · NativeWind-free (web only) · Tailwind v4

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/011_chat_messages.sql` | Table + RLS |
| Create | `supabase/migrations/011_chat_messages_down.sql` | Rollback |
| Create | `apps/web/lib/chat/systemPrompt.ts` | Build financial context string |
| Create | `apps/web/app/api/chat/route.ts` | Stream handler |
| Create | `apps/web/components/layout/ChatSidebar.tsx` | Chat UI client component |
| Modify | `apps/web/app/dashboard/layout.tsx` | Add ChatSidebar as third column |
| Modify | `apps/web/package.json` | Add `openai` dependency |

---

## Task 1: Install dependency + DB migration

**Files:** `apps/web/package.json`, `supabase/migrations/011_*`

- [ ] **Step 1: Install openai package**

```bash
pnpm --filter web add openai
```

- [ ] **Step 2: Create migration**

Create `supabase/migrations/011_chat_messages.sql`:

```sql
CREATE TABLE public.chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_created
  ON public.chat_messages (user_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own messages"
  ON public.chat_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 3: Create rollback**

Create `supabase/migrations/011_chat_messages_down.sql`:

```sql
DROP TABLE IF EXISTS public.chat_messages;
```

- [ ] **Step 4: Apply migration** via Supabase MCP `apply_migration` tool or dashboard SQL editor. Verify table exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/011_chat_messages.sql supabase/migrations/011_chat_messages_down.sql apps/web/package.json pnpm-lock.yaml
git commit -m "feat(chat): add openai dep and chat_messages migration"
```

---

## Task 2: System prompt builder

**Files:**
- Create: `apps/web/lib/chat/systemPrompt.ts`
- Create: `apps/web/__tests__/lib/chat/systemPrompt.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/__tests__/lib/chat/systemPrompt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

describe('buildSystemPrompt', () => {
  const context = {
    today: '2026-04-29',
    yearMonth: '2026-04',
    metrics: { income: 5000, expense: 3200, net: 1800 },
    wallets: [
      { name: 'Checking', type: 'debit' as const, balance: 2400, currency: 'PLN' },
    ],
    transactions: [
      { date: '2026-04-15', merchant: 'Biedronka', type: 'expense' as const, amount: '120.50', category: 'Groceries' },
    ],
  }

  it('includes monthly income figure', () => {
    expect(buildSystemPrompt(context)).toContain('5000')
  })

  it('includes wallet name', () => {
    expect(buildSystemPrompt(context)).toContain('Checking')
  })

  it('includes transaction merchant', () => {
    expect(buildSystemPrompt(context)).toContain('Biedronka')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter web exec vitest run __tests__/lib/chat/systemPrompt.test.ts
```

Expected: `Cannot find module '@/lib/chat/systemPrompt'`

- [ ] **Step 3: Implement**

Create `apps/web/lib/chat/systemPrompt.ts`:

```typescript
import type { WalletWithBalance } from '@/types/database'
import type { MonthlyMetrics } from '@/lib/supabase/queries/metrics'

interface Transaction {
  date: string
  merchant: string
  type: string
  amount: string
  category: string | null
}

interface PromptContext {
  today: string
  yearMonth: string
  metrics: MonthlyMetrics
  wallets: WalletWithBalance[]
  transactions: Transaction[]
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const walletLines = ctx.wallets
    .map((w) => `- ${w.name} (${w.type}): ${w.balance.toFixed(2)} ${w.currency}`)
    .join('\n')

  const txLines = ctx.transactions
    .map((t) => `${t.date} | ${t.merchant} | ${t.type} | ${t.amount} | ${t.category ?? '—'}`)
    .join('\n')

  return `You are a personal finance coach for a Polish user.
Today is ${ctx.today}. All amounts are in PLN unless noted otherwise.

## This month (${ctx.yearMonth})
- Income:      ${ctx.metrics.income.toFixed(2)} PLN
- Expenses:    ${ctx.metrics.expense.toFixed(2)} PLN
- Net:         ${ctx.metrics.net.toFixed(2)} PLN
- Savings rate: ${ctx.metrics.income > 0 ? (((ctx.metrics.income - ctx.metrics.expense) / ctx.metrics.income) * 100).toFixed(0) : 0}%

## Wallets
${walletLines || 'No wallets yet.'}

## Recent transactions (last 50)
date       | merchant | type | amount | category
${txLines || 'No transactions yet.'}

Answer in the same language the user writes in.
Be concise and specific — refer to actual numbers from the data above.`
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter web exec vitest run __tests__/lib/chat/systemPrompt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chat/systemPrompt.ts apps/web/__tests__/lib/chat/systemPrompt.test.ts
git commit -m "feat(chat): add system prompt builder with tests"
```

---

## Task 3: API Route

**Files:**
- Create: `apps/web/app/api/chat/route.ts`

- [ ] **Step 1: Add env vars**

Add to `apps/web/.env.local`:

```
NVIDIA_API_KEY=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
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
```

- [ ] **Step 2: Create route**

Create `apps/web/app/api/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY!,
      baseURL: process.env.NVIDIA_BASE_URL!,
    })
  }
  return _openai
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429 })
    }

    const { message } = await req.json() as { message: string }
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'EMPTY_MESSAGE' }), { status: 400 })
    }

    // Load last 20 messages for LLM context (authoritative from DB)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    const orderedHistory = (history ?? []).reverse()

    // Fetch financial context in parallel
    const yearMonth = currentYearMonth()
    const [metrics, wallets, txResult] = await Promise.all([
      getMonthlyMetrics(yearMonth),
      getUserWalletsWithBalances(supabase),
      supabase
        .from('transactions')
        .select('date, merchant, type, amount, category:categories(name)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50),
    ])

    const transactions = (txResult.data ?? []).map((t) => ({
      date: t.date,
      merchant: t.merchant,
      type: t.type,
      amount: t.amount as unknown as string,
      category: (t.category as { name: string } | null)?.name ?? null,
    }))

    const systemPrompt = buildSystemPrompt({
      today: new Date().toISOString().slice(0, 10),
      yearMonth,
      metrics,
      wallets,
      transactions,
    })

    const stream = await getOpenAI().chat.completions.create({
      model: process.env.NVIDIA_MODEL!,
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...orderedHistory,
        { role: 'user', content: message },
      ],
    })

    let assistantReply = ''

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) {
              assistantReply += text
              controller.enqueue(encoder.encode(text))
            }
          }
        } finally {
          controller.close()
          // Persist both messages after stream completes
          await supabase.from('chat_messages').insert([
            { user_id: user.id, role: 'user', content: message },
            { user_id: user.id, role: 'assistant', content: assistantReply },
          ])
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[chat] error', err)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 })
  }
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter web build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/chat/route.ts apps/web/.env.local
git commit -m "feat(chat): add streaming chat API route"
```

---

## Task 4: ChatSidebar component

**Files:**
- Create: `apps/web/components/layout/ChatSidebar.tsx`

- [ ] **Step 1: Create component**

Create `apps/web/components/layout/ChatSidebar.tsx`:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STARTER_PROMPTS = [
  'Why did I overspend this month?',
  'How is my savings rate trending?',
  'Which wallet has the highest balance?',
  'Give me a spending breakdown by category',
]

function getBrowserSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default function ChatSidebar() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = getBrowserSupabase()
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
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
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Coach</span>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {loading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && !streaming && (
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
              Ask anything about your finances
            </p>
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
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
                ? 'ml-auto bg-zinc-800 text-white dark:bg-zinc-700'
                : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {streamingContent && (
          <div className="max-w-[90%] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200">
            {streamingContent}
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-zinc-400" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {error && (
          <p className="mb-2 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Ask about your finances…"
            className="flex-1 resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            aria-label="Send"
          >
            {streaming ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
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
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/ChatSidebar.tsx
git commit -m "feat(chat): add ChatSidebar client component"
```

---

## Task 5: Wire into layout

**Files:**
- Modify: `apps/web/app/dashboard/layout.tsx`

- [ ] **Step 1: Update layout**

Replace content of `apps/web/app/dashboard/layout.tsx`:

```typescript
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import ChatSidebar from '@/components/layout/ChatSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
          <ChatSidebar />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: clean.

- [ ] **Step 3: Smoke test** — open `http://localhost:3000/dashboard`, verify:
  - Chat sidebar appears on the right
  - Starter prompts appear when history is empty
  - Sending a message streams a response
  - Refreshing the page reloads prior messages

- [ ] **Step 4: Final commit**

```bash
git add apps/web/app/dashboard/layout.tsx
git commit -m "feat(chat): wire ChatSidebar into dashboard layout"
```

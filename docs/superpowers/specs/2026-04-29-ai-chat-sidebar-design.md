# Design: AI Chat Sidebar

**Date:** 2026-04-29
**Status:** Approved

---

## Overview

A fixed right-hand chat panel visible on all dashboard pages. The AI coach (DeepSeek v4 Pro via NVIDIA NIM) receives a full financial context snapshot on every request and can answer questions about income, expenses, wallet balances, and spending trends. Conversation history is persisted in Supabase.

---

## Architecture

### Layout change

`apps/web/app/dashboard/layout.tsx` gains a third column:

```
[LeftSidebar 240px] | [TopBar + main flex-1] | [ChatSidebar 320px]
```

`ChatSidebar` is a `'use client'` component rendered inside the server layout. `main` shrinks naturally — no toggle, no overlay.

### Components and files

| File | Purpose |
|------|---------|
| `apps/web/app/dashboard/layout.tsx` | Add `<ChatSidebar />` as third column |
| `apps/web/components/layout/ChatSidebar.tsx` | Client component — messages, input, starter prompts |
| `apps/web/app/api/chat/route.ts` | POST route — auth, context fetch, NIM streaming, persist |
| `apps/web/lib/chat/systemPrompt.ts` | Builds the financial context system prompt string |
| `supabase/migrations/011_chat_messages.sql` | New table + RLS |
| `supabase/migrations/011_chat_messages_down.sql` | Rollback |

---

## Database

### `chat_messages` table

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

---

## API Route — `POST /api/chat`

**Request body:**
```ts
{ message: string }
```

History is not sent from the client — the route loads the last 20 messages from Supabase directly (avoids sending large payloads from the browser and ensures history is authoritative).

**Server steps:**
1. Authenticate user via Supabase session cookie
2. Rate-limit: 20 req/hour per user (in-memory map, same pattern as OCR route)
3. Load last 20 `chat_messages` for the user from Supabase
4. Fetch financial context in parallel:
   - `getMonthlyMetrics(currentYearMonth)`
   - `getUserWalletsWithBalances(supabase)`
   - Last 50 transactions (date, merchant, amount, type, category name)
5. Build system prompt via `buildSystemPrompt(context)` — returns a structured text block
6. Call NVIDIA NIM via OpenAI SDK with `stream: true`
7. Return `ReadableStream` (plain text, `Content-Type: text/plain; charset=utf-8`)
8. After stream ends, persist both messages to `chat_messages`

**Env vars:**
```
NVIDIA_API_KEY=nvapi-...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
```

**Error responses:** `401` unauthenticated, `429` rate limited, `500` upstream failure.

---

## System Prompt

`buildSystemPrompt` injects:

```
You are a personal finance coach for a Polish user.
Today is {date}. Currency: PLN unless otherwise stated.

## This month ({YYYY-MM})
- Income:   {X} PLN
- Expenses: {X} PLN
- Savings rate: {X}%

## Wallets
{name} ({type}): {balance} {currency}
...

## Recent transactions (last 50)
{date} | {merchant} | {type} | {amount} PLN | {category}
...

Answer in the same language the user writes in.
Be concise and specific — refer to actual numbers from the data above.
```

---

## Client Component — `ChatSidebar`

**File:** `apps/web/components/layout/ChatSidebar.tsx`

### State
- `messages: { id, role, content, pending? }[]` — local list; initialised from Supabase on mount
- `input: string`
- `streaming: boolean` — disables input while response is in flight
- `streamingContent: string` — accumulates in-progress assistant reply

### On mount
Fetches latest 100 messages from Supabase browser client ordered by `created_at ASC`. Shows a skeleton while loading.

### Starter prompts (shown when `messages` is empty)
- "Why did I overspend this month?"
- "How is my savings rate trending?"
- "Which wallet has the highest balance?"
- "Give me a spending breakdown by category"

Clicking a chip calls `sendMessage(prompt)` immediately.

### Send flow
1. Append user message to local state (optimistic)
2. Clear input, set `streaming = true`
3. `fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) })`
4. Read `response.body` as `ReadableStream`, decode chunks, accumulate into `streamingContent`
5. On stream end: push final assistant message into `messages`, clear `streamingContent`, set `streaming = false`

### Input behaviour
- `Enter` → send; `Shift+Enter` → newline
- Textarea disabled while `streaming`
- Send button shows spinner while streaming

### Layout
```
┌─ border-l, w-80, h-full, flex col ──────────────┐
│  Header: "AI Coach"  (h-16, border-b)            │
│  Messages area (flex-1, overflow-y-auto, p-3)    │
│    User bubble: right-aligned, zinc-800 bg       │
│    Assistant bubble: left-aligned, no bg         │
│    Starter chips: centered, shown when empty     │
│  Input row (border-t, p-3)                       │
│    Textarea (auto-resize) + Send button          │
└──────────────────────────────────────────────────┘
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| NIM API unreachable | Stream returns error chunk; displayed as assistant error message |
| Rate limit hit | 429 → inline error message below input: "Too many messages, try again later" |
| Auth expired | 401 → redirect to login (handled by existing proxy middleware) |
| Empty message | Send button disabled; no request fired |

---

## Out of Scope

- Mobile (ChatSidebar is web-only for now)
- Chat history UI (clear / export)
- Multiple chat sessions / threads
- Tool-call / function-calling mode (future phase)

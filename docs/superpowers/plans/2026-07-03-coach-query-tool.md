# AI Coach Receipt Query Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The coach answers item-level questions about any date range by calling a `query_receipt_items` function against the DB mid-chat.

**Architecture:** `lib/chat/tools.ts` holds the tool schema, a Zod-validated executor that never throws, and a pure streaming-delta assembler. The chat route becomes a bounded streaming loop (≤3 tool rounds): text deltas stream to the client unchanged; `finish_reason === 'tool_calls'` triggers executor calls whose JSON results are appended as `tool` messages before the next round. First-call API errors retry once without `tools`.

**Tech Stack:** OpenAI SDK (chat.completions streaming + tools) against NVIDIA NIM, Zod, Supabase PostgREST, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-coach-query-tool-design.md`.
- **Do not commit** — leave the working tree for user review.
- All paths relative to `apps/web/`.
- Tool executor **never throws**; invalid args / query errors return `{"error": "..."}` JSON strings.
- Max 3 tool rounds; after that one final call without `tools`. First-call failure with `tools` → retry once without.
- Persisted chat history stays prose-only (user + final assistant text), as today.

---

### Task 1: `lib/chat/tools.ts` — schema, executor, delta assembler

**Files:**
- Create: `lib/chat/tools.ts`
- Test: `__tests__/lib/chat/tools.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const receiptQueryTool: ChatCompletionTool           // name: 'query_receipt_items'
  export const ReceiptQueryArgsSchema: z.ZodType              // { start_date, end_date, search?, limit? }
  export async function executeReceiptQuery(supabase: SupabaseClient, rawArgs: unknown): Promise<string>
  export interface AssembledToolCall { id: string; name: string; arguments: string }
  export function assembleToolCallDeltas(deltas: ToolCallDelta[][]): AssembledToolCall[]
  export type ToolCallDelta = { index: number; id?: string; function?: { name?: string; arguments?: string } }
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/lib/chat/tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ReceiptQueryArgsSchema,
  executeReceiptQuery,
  assembleToolCallDeltas,
} from '@/lib/chat/tools'

describe('ReceiptQueryArgsSchema', () => {
  it('accepts valid args and defaults limit to 100', () => {
    const parsed = ReceiptQueryArgsSchema.parse({ start_date: '2026-03-01', end_date: '2026-03-31' })
    expect(parsed).toEqual({ start_date: '2026-03-01', end_date: '2026-03-31', limit: 100 })
  })

  it('rejects malformed dates and out-of-range limits', () => {
    expect(ReceiptQueryArgsSchema.safeParse({ start_date: 'March', end_date: '2026-03-31' }).success).toBe(false)
    expect(ReceiptQueryArgsSchema.safeParse({ start_date: '2026-03-01', end_date: '2026-03-31', limit: 500 }).success).toBe(false)
  })
})

describe('executeReceiptQuery', () => {
  const mockResult = vi.fn()
  function makeSupabase() {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lte', 'or', 'order', 'limit']) {
      chain[m] = vi.fn(() => chain)
    }
    ;(chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(mockResult())
    return { from: vi.fn(() => chain) } as never
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.mockReturnValue({
      data: [
        {
          name: 'RAW CHLEB', canonical_product_name: 'Chleb zwykły', normalized_name: null,
          quantity: 1, total_price: 3.49,
          category: { name: 'Groceries' },
          transaction: { date: '2026-03-05', merchant: 'Biedronka' },
        },
      ],
      error: null,
    })
  })

  it('returns shaped items JSON for valid args', async () => {
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31' }))
    expect(out.items).toEqual([
      { date: '2026-03-05', merchant: 'Biedronka', name: 'Chleb zwykły', quantity: 1, total_price: 3.49, category: 'Groceries' },
    ])
    expect(out.truncated).toBe(false)
  })

  it('flags truncation when more rows than limit come back', async () => {
    mockResult.mockReturnValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        name: `P${i}`, canonical_product_name: null, normalized_name: null,
        quantity: 1, total_price: 1,
        category: null,
        transaction: { date: '2026-03-05', merchant: 'X' },
      })),
      error: null,
    })
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31', limit: 2 }))
    expect(out.items).toHaveLength(2)
    expect(out.truncated).toBe(true)
  })

  it('returns error JSON for invalid args without throwing', async () => {
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: 'nope' }))
    expect(out.error).toBeTruthy()
  })

  it('returns error JSON when the query fails', async () => {
    mockResult.mockReturnValue({ data: null, error: { message: 'boom' } })
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31' }))
    expect(out.error).toContain('boom')
  })
})

describe('assembleToolCallDeltas', () => {
  it('assembles a call whose name and arguments arrive in fragments', () => {
    const rounds = [
      [{ index: 0, id: 'call_1', function: { name: 'query_receipt_items', arguments: '{"start' } }],
      [{ index: 0, function: { arguments: '_date":"2026-03-01"}' } }],
    ]
    expect(assembleToolCallDeltas(rounds)).toEqual([
      { id: 'call_1', name: 'query_receipt_items', arguments: '{"start_date":"2026-03-01"}' },
    ])
  })

  it('keeps parallel calls separate by index', () => {
    const rounds = [[
      { index: 0, id: 'a', function: { name: 'query_receipt_items', arguments: '{}' } },
      { index: 1, id: 'b', function: { name: 'query_receipt_items', arguments: '{"limit":5}' } },
    ]]
    const out = assembleToolCallDeltas(rounds)
    expect(out.map((c) => c.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/chat/tools.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/chat/tools.ts`**

```ts
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const ReceiptQueryArgsSchema = z.object({
  start_date: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  end_date: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  search: z.string().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(200).default(100),
})

export const receiptQueryTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'query_receipt_items',
    description:
      'Look up individual products the user bought from scanned receipts in a date range. ' +
      'Use this for purchases not listed in the system prompt (older receipts or specific searches).',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Range start, YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Range end (inclusive), YYYY-MM-DD' },
        search: { type: 'string', description: 'Optional case-insensitive product-name filter' },
        limit: { type: 'number', description: 'Max items to return, 1-200 (default 100)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
}

type ReceiptQueryRow = {
  name: string
  canonical_product_name: string | null
  normalized_name: string | null
  quantity: number
  total_price: number
  category: { name: string } | { name: string }[] | null
  transaction: { date: string; merchant: string } | null
}

/**
 * Run the query_receipt_items tool. Always resolves to a JSON string —
 * `{items, truncated}` on success, `{error}` on any failure — so a bad
 * model call can never break the chat stream.
 */
export async function executeReceiptQuery(supabase: SupabaseClient, rawArgs: unknown): Promise<string> {
  const parsed = ReceiptQueryArgsSchema.safeParse(rawArgs)
  if (!parsed.success) {
    return JSON.stringify({ error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join('; ')}` })
  }
  const { start_date, end_date, search, limit } = parsed.data

  try {
    let query = supabase
      .from('receipt_items')
      .select(
        'name, canonical_product_name, normalized_name, quantity, total_price, category:categories(name), transaction:transactions!transaction_id!inner(date, merchant)',
      )
      .eq('transaction.source', 'ocr')
      .gte('transaction.date', start_date)
      .lte('transaction.date', end_date)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (search) {
      const term = search.replace(/[%_,()]/g, ' ').trim()
      if (term) {
        query = query.or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%,canonical_product_name.ilike.%${term}%`)
      }
    }

    const { data, error } = await query
    if (error) {
      return JSON.stringify({ error: `Query failed: ${error.message}` })
    }

    const rows = (data ?? []) as unknown as ReceiptQueryRow[]
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map((row) => ({
      date: row.transaction?.date ?? null,
      merchant: row.transaction?.merchant ?? null,
      name: row.canonical_product_name ?? row.normalized_name ?? row.name,
      quantity: row.quantity,
      total_price: Number(row.total_price),
      category: Array.isArray(row.category) ? (row.category[0]?.name ?? null) : (row.category?.name ?? null),
    }))

    return JSON.stringify({ items, truncated })
  } catch (err) {
    return JSON.stringify({ error: `Query failed: ${err instanceof Error ? err.message : 'unknown'}` })
  }
}

export type ToolCallDelta = {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

export interface AssembledToolCall {
  id: string
  name: string
  arguments: string
}

/** Reassemble streamed tool-call fragments (grouped per chunk) into whole calls. */
export function assembleToolCallDeltas(deltas: ToolCallDelta[][]): AssembledToolCall[] {
  const byIndex = new Map<number, AssembledToolCall>()
  for (const chunk of deltas) {
    for (const d of chunk) {
      const existing = byIndex.get(d.index) ?? { id: '', name: '', arguments: '' }
      if (d.id) existing.id = d.id
      if (d.function?.name) existing.name += d.function.name
      if (d.function?.arguments) existing.arguments += d.function.arguments
      byIndex.set(d.index, existing)
    }
  }
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, call]) => call)
}
```

Note: the mock in Step 1 makes the query chain thenable; if the `!inner` join hint on `transactions` mis-parses against the mock, keep the assertion focus on the returned JSON shape (the chain is opaque to the test).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/lib/chat/tools.test.ts`
Expected: 8 passed.

- [ ] **Step 5: ~~Commit~~** Skipped (Global Constraints).

---

### Task 2: System prompt mentions the tool

**Files:**
- Modify: `lib/chat/systemPrompt.ts`
- Test: `__tests__/lib/chat/systemPrompt.test.ts` (extend)

**Interfaces:** none new.

- [ ] **Step 1: Add failing test**

```ts
it('tells the model about the query_receipt_items tool', () => {
  expect(buildSystemPrompt(context)).toContain('query_receipt_items')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/chat/systemPrompt.test.ts`
Expected: 1 new FAIL.

- [ ] **Step 3: Implement** — in the template, directly under the `## Recent receipts (line items)` block, add:

```
The receipt list above covers only the most recent receipts. For older purchases or
specific product searches, call the query_receipt_items tool with a date range.
```

- [ ] **Step 4: Run to verify pass** — all systemPrompt tests green.

- [ ] **Step 5: ~~Commit~~** Skipped.

---

### Task 3: Streaming tool loop in the chat route + full verification

**Files:**
- Modify: `app/api/chat/route.ts` (imports; the `stream`/`ReadableStream` section, currently `:133-172`)

**Interfaces:**
- Consumes: `receiptQueryTool`, `executeReceiptQuery`, `assembleToolCallDeltas`, `ToolCallDelta` (Task 1).

- [ ] **Step 1: Implement the loop.** Replace the single `create()` + `for await` with:

```ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { receiptQueryTool, executeReceiptQuery, assembleToolCallDeltas, type ToolCallDelta } from '@/lib/chat/tools'
```

```ts
const model = process.env.NVIDIA_MODEL
if (!model) throw new Error('Missing env var: NVIDIA_MODEL')

const conversation: ChatCompletionMessageParam[] = [
  { role: 'system', content: systemPrompt },
  ...(orderedHistory as ChatCompletionMessageParam[]),
  { role: 'user', content: message },
]

const MAX_TOOL_ROUNDS = 3
let assistantReply = ''

async function createStream(withTools: boolean) {
  return getOpenAI().chat.completions.create({
    model: model!,
    stream: true,
    max_tokens: 16384,
    temperature: 0.7,
    top_p: 1,
    messages: conversation,
    ...(withTools ? { tools: [receiptQueryTool] } : {}),
  })
}

const readable = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder()
    try {
      let toolsEnabled = true

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        // Last permitted round runs without tools so the user always gets prose.
        const withTools = toolsEnabled && round < MAX_TOOL_ROUNDS

        let stream
        try {
          stream = await createStream(withTools)
        } catch (err) {
          if (!withTools) throw err
          // Model/provider rejected the tools param — degrade gracefully.
          console.error('[chat] tools_unsupported, retrying without tools', err)
          toolsEnabled = false
          stream = await createStream(false)
        }

        const toolCallChunks: ToolCallDelta[][] = []
        let finishReason: string | null = null

        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          const text = choice?.delta?.content ?? ''
          if (text) {
            assistantReply += text
            controller.enqueue(encoder.encode(text))
          }
          if (choice?.delta?.tool_calls) {
            toolCallChunks.push(choice.delta.tool_calls as ToolCallDelta[])
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason
        }

        if (finishReason !== 'tool_calls') break

        const calls = assembleToolCallDeltas(toolCallChunks)
        conversation.push({
          role: 'assistant',
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function' as const,
            function: { name: c.name, arguments: c.arguments },
          })),
        })
        for (const call of calls) {
          let args: unknown
          try { args = JSON.parse(call.arguments || '{}') } catch { args = call.arguments }
          const result = call.name === 'query_receipt_items'
            ? await executeReceiptQuery(supabase, args)
            : JSON.stringify({ error: `Unknown tool: ${call.name}` })
          conversation.push({ role: 'tool', tool_call_id: call.id, content: result })
        }
      }

      controller.close()
    } catch (err) {
      controller.error(err)
    } finally {
      if (assistantReply) {
        await supabase.from('chat_messages').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: assistantReply },
        ])
      }
    }
  },
})
```

(The `let assistantReply` declaration replaces the existing one; delete the old single-stream block. Keep the surrounding `return new Response(readable, ...)` unchanged.)

- [ ] **Step 2: Typecheck**: `pnpm --filter web exec tsc --noEmit` — clean. (Watch the `orderedHistory` cast and OpenAI tool-call message types.)
- [ ] **Step 3: Full suite**: `pnpm --filter web exec vitest run` (all pass, 100 total expected), `pnpm --filter web lint` (0 errors), `pnpm --filter web build` (succeeds).
- [ ] **Step 4: Smoke** if NIM env vars are available locally; otherwise state that live tool-calling must be confirmed in the deployed app with a question like "co kupiłem w marcu?".
- [ ] **Step 5: ~~Commit~~** Skipped; report.

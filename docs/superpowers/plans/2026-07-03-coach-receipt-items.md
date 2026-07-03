# AI Coach Receipt Line Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI coach can answer questions about individual positions on the user's recent receipts.

**Architecture:** A new query fetches the 10 most recent OCR transactions joined with their receipt items and category names; a pure shaping helper (unit-tested) formats/caps them; `buildSystemPrompt` renders them as a new section; the chat route adds the query to its existing parallel fetch with a `.catch(() => [])` guard.

**Tech Stack:** Next.js 16 route handler, Supabase PostgREST joins, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-coach-receipt-items-design.md`.
- **Do not commit** — leave the working tree for user review.
- All paths relative to `apps/web/`.
- Item display name fallback chain: `canonical_product_name → normalized_name → name` (same as `getTopProducts`).
- Hard cap: 150 items across all receipts, dropping the oldest receipts first; receipt limit default 10.
- A receipts-query failure must not break chat.

---

### Task 1: `getRecentReceiptsWithItems` + shaping helper

**Files:**
- Modify: `lib/supabase/queries/receiptItems.ts`
- Test: `__tests__/lib/receiptsWithItems.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ReceiptItemLine { name: string; quantity: number; total_price: number; category: string | null }
  export interface ReceiptWithItems { merchant: string; date: string; total: string; items: ReceiptItemLine[] }
  export function shapeReceiptsWithItems(rows: RawReceiptRow[], maxItems?: number): ReceiptWithItems[]
  export async function getRecentReceiptsWithItems(limit?: number, supabaseClient?: SupabaseClient): Promise<ReceiptWithItems[]>
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/receiptsWithItems.test.ts
import { describe, it, expect } from 'vitest'
import { shapeReceiptsWithItems } from '../../lib/supabase/queries/receiptItems'

function makeRow(merchant: string, date: string, itemCount: number) {
  return {
    merchant,
    date,
    amount: '10.00',
    receipt_items: Array.from({ length: itemCount }, (_, i) => ({
      name: `RAW ${merchant} ${i}`,
      canonical_product_name: i % 2 === 0 ? `Canonical ${merchant} ${i}` : null,
      normalized_name: null,
      quantity: 1,
      total_price: 2.5,
      category: i % 2 === 0 ? { name: 'Groceries' } : null,
    })),
  }
}

describe('shapeReceiptsWithItems', () => {
  it('shapes rows with display-name fallback and category unwrap', () => {
    const out = shapeReceiptsWithItems([makeRow('Biedronka', '2026-07-02', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].merchant).toBe('Biedronka')
    expect(out[0].items[0]).toEqual({
      name: 'Canonical Biedronka 0', quantity: 1, total_price: 2.5, category: 'Groceries',
    })
    expect(out[0].items[1].name).toBe('RAW Biedronka 1')
    expect(out[0].items[1].category).toBeNull()
  })

  it('caps total items at maxItems by dropping oldest receipts (rows are newest-first)', () => {
    const rows = [makeRow('A', '2026-07-03', 3), makeRow('B', '2026-07-02', 3), makeRow('C', '2026-07-01', 3)]
    const out = shapeReceiptsWithItems(rows, 5)
    expect(out.map((r) => r.merchant)).toEqual(['A'])
  })

  it('handles category returned as array (PostgREST shape)', () => {
    const row = makeRow('X', '2026-07-01', 1)
    ;(row.receipt_items[0] as { category: unknown }).category = [{ name: 'Dairy' }]
    expect(shapeReceiptsWithItems([row])[0].items[0].category).toBe('Dairy')
  })

  it('returns empty array for no rows', () => {
    expect(shapeReceiptsWithItems([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/receiptsWithItems.test.ts`
Expected: FAIL — `shapeReceiptsWithItems` is not exported.

- [ ] **Step 3: Implement** — append to `lib/supabase/queries/receiptItems.ts`:

```ts
export interface ReceiptItemLine {
  name: string
  quantity: number
  total_price: number
  category: string | null
}

export interface ReceiptWithItems {
  merchant: string
  date: string
  total: string
  items: ReceiptItemLine[]
}

type RawReceiptRow = {
  merchant: string
  date: string
  amount: string
  receipt_items: Array<{
    name: string
    canonical_product_name: string | null
    normalized_name: string | null
    quantity: number
    total_price: number
    category: { name: string } | { name: string }[] | null
  }>
}

/**
 * Shape joined transaction→receipt_items rows for the chat prompt.
 * Rows must be ordered newest-first; receipts are dropped from the tail
 * (oldest) once the total item count would exceed maxItems.
 */
export function shapeReceiptsWithItems(rows: RawReceiptRow[], maxItems = 150): ReceiptWithItems[] {
  const receipts: ReceiptWithItems[] = []
  let itemCount = 0
  for (const row of rows) {
    if (itemCount + row.receipt_items.length > maxItems) break
    itemCount += row.receipt_items.length
    receipts.push({
      merchant: row.merchant,
      date: row.date,
      total: row.amount,
      items: row.receipt_items.map((item) => ({
        name: item.canonical_product_name ?? item.normalized_name ?? item.name,
        quantity: item.quantity,
        total_price: Number(item.total_price),
        category: Array.isArray(item.category)
          ? (item.category[0]?.name ?? null)
          : (item.category?.name ?? null),
      })),
    })
  }
  return receipts
}

/**
 * Line items of the user's most recent scanned receipts, for the AI coach.
 * RLS scopes rows to the current user.
 */
export async function getRecentReceiptsWithItems(
  limit = 10,
  supabaseClient?: SupabaseClient,
): Promise<ReceiptWithItems[]> {
  const supabase = supabaseClient || await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'merchant, date, amount, receipt_items(name, canonical_product_name, normalized_name, quantity, total_price, category:categories(name))',
    )
    .eq('source', 'ocr')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch recent receipts: ${error.message}`)
  }

  return shapeReceiptsWithItems((data ?? []) as unknown as RawReceiptRow[])
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/lib/receiptsWithItems.test.ts`
Expected: 4 passed.

- [ ] **Step 5: ~~Commit~~** Skipped (Global Constraints).

---

### Task 2: System prompt section

**Files:**
- Modify: `lib/chat/systemPrompt.ts`
- Test: `__tests__/lib/chat/systemPrompt.test.ts` (existing — extend; the existing `context` fixture gains `recentReceipts: []`)

**Interfaces:**
- Consumes: `ReceiptWithItems` from Task 1.
- Produces: `PromptContext.recentReceipts: ReceiptWithItems[]` (required field).

- [ ] **Step 1: Extend the existing test file** — add `recentReceipts: []` to the shared `context` fixture, then add:

```ts
it('renders receipt line items grouped by receipt', () => {
  const prompt = buildSystemPrompt({
    ...context,
    recentReceipts: [
      {
        merchant: 'Lidl', date: '2026-04-20', total: '10.48',
        items: [
          { name: 'Chleb zwykły', quantity: 1, total_price: 3.49, category: 'Groceries' },
          { name: 'Mleko 2%', quantity: 2, total_price: 6.99, category: null },
        ],
      },
    ],
  })
  expect(prompt).toContain('### Lidl — 2026-04-20 — 10.48 PLN')
  expect(prompt).toContain('- Chleb zwykły ×1 — 3.49 (Groceries)')
  expect(prompt).toContain('- Mleko 2% ×2 — 6.99 (—)')
})

it('shows empty state when no receipts', () => {
  expect(buildSystemPrompt(context)).toContain('No receipts scanned yet.')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/chat/systemPrompt.test.ts`
Expected: existing tests fail to compile (missing `recentReceipts`) or the two new tests FAIL.

- [ ] **Step 3: Implement** in `lib/chat/systemPrompt.ts`:

```ts
import type { TopProduct, ReceiptWithItems } from '@/lib/supabase/queries/receiptItems'
```

Add `recentReceipts: ReceiptWithItems[]` to `PromptContext`. Before the `return`, build:

```ts
const receiptBlocks = ctx.recentReceipts
  .map((r) => {
    const itemLines = r.items
      .map((i) => `- ${i.name} ×${i.quantity} — ${i.total_price.toFixed(2)} (${i.category ?? '—'})`)
      .join('\n')
    return `### ${r.merchant} — ${r.date} — ${Number(r.total).toFixed(2)} PLN\n${itemLines}`
  })
  .join('\n\n')
```

Insert a new section between "Recent transactions" and "Top products":

```
## Recent receipts (line items)
${receiptBlocks || 'No receipts scanned yet.'}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/lib/chat/systemPrompt.test.ts`
Expected: all pass (existing + 2 new).

- [ ] **Step 5: ~~Commit~~** Skipped.

---

### Task 3: Chat route wiring + full verification

**Files:**
- Modify: `app/api/chat/route.ts:96-129`

**Interfaces:**
- Consumes: `getRecentReceiptsWithItems(limit?, supabaseClient?)` (Task 1); `PromptContext.recentReceipts` (Task 2).

- [ ] **Step 1: Wire the query.** Import `getRecentReceiptsWithItems` alongside `getTopProducts`. In the `Promise.all`, append:

```ts
getRecentReceiptsWithItems(10, supabase).catch(() => []),
```

destructure as `recentReceipts`, and pass `recentReceipts` into `buildSystemPrompt({ ... })`.

- [ ] **Step 2: Typecheck**: `pnpm --filter web exec tsc --noEmit` — clean.
- [ ] **Step 3: Full suite**: `pnpm --filter web exec vitest run` (all pass), `pnpm --filter web lint` (no errors), `pnpm --filter web build` (succeeds).
- [ ] **Step 4: Smoke** (if dev env has NVIDIA vars): ask the coach "what's on my last receipt?" and confirm it references actual items. Otherwise note the limitation in the report.
- [ ] **Step 5: ~~Commit~~** Skipped; report results.

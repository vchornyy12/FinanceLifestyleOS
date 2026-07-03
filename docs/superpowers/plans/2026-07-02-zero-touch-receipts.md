# Zero-Touch Receipts & Simplified Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receipt upload becomes the only user step (parse → categorize → save happens server-side), category management UI disappears, and the dashboard focuses on income/expenses.

**Architecture:** The Netlify background OCR function gains an opt-in auto-save stage (gated by a new `receipt_parse_jobs.auto_save` column so mobile's review flow keeps working). Category assignment reuses the existing history-lookup plus a fuzzy name match against the user's categories. The web dashboard gets a QuickUpload dropzone and an expenses/income layout; receipts review pages, categories settings, and category pickers are deleted.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` not middleware), Supabase (service-role client in background fn), Vitest, Tailwind v4.

## Global Constraints

- **DO NOT COMMIT.** The working tree has unrelated in-flight user changes (chat sidebar refactor). Skip every commit step; the user will review and commit.
- Spec: `docs/superpowers/specs/2026-07-02-zero-touch-receipts-design.md`.
- Read `node_modules/next/dist/docs/` guidance before writing Next.js code (per `apps/web/AGENTS.md`).
- All paths below are relative to `apps/web/` unless they start with `supabase/`.
- No destructive DB changes; migration 017 is additive with a paired `_down.sql`.
- Unit tests: `pnpm --filter web exec vitest run <file>`. Lint: `pnpm --filter web lint`. Build: `pnpm --filter web build`.
- Keep `lib/supabase/queries/*` pattern: functions default to `createClient()` from `@/lib/supabase/server` but accept an optional client param where needed.

---

### Task 1: Migration 017 — `auto_save` flag on receipt_parse_jobs

**Files:**
- Create: `supabase/migrations/017_receipt_jobs_auto_save.sql`
- Create: `supabase/migrations/017_receipt_jobs_auto_save_down.sql`
- Modify: `apps/web/types/database.ts` (ReceiptParseJob types)

**Interfaces:**
- Produces: `receipt_parse_jobs.auto_save boolean not null default false`; TS types `ReceiptParseJobRow.auto_save: boolean`, `ReceiptParseJobInsert.auto_save?: boolean`.

- [ ] **Step 1: Write the up migration**

```sql
-- 017_receipt_jobs_auto_save.sql
-- Zero-touch receipts: jobs created with auto_save=true are saved as a
-- transaction + receipt_items by the background function after parsing.
-- Default false keeps the mobile review flow unchanged.

ALTER TABLE public.receipt_parse_jobs
  ADD COLUMN auto_save boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Write the down migration**

```sql
-- 017_receipt_jobs_auto_save_down.sql
ALTER TABLE public.receipt_parse_jobs
  DROP COLUMN IF EXISTS auto_save;
```

- [ ] **Step 3: Update TS types**

In `types/database.ts`, find `ReceiptParseJobRow` / `ReceiptParseJobInsert` / `ReceiptParseJobUpdate` and add:
- Row: `auto_save: boolean`
- Insert: `auto_save?: boolean`
- Update: `auto_save?: boolean`

Add a comment noting the canonical fix is `supabase gen types` after applying the migration.

- [ ] **Step 4: Apply migration** via Supabase MCP server (project `agkvjwysvwvsmequbpub`) or ask user to run it. If MCP is unavailable, note it in the final report — code is safe either way because `auto_save` defaults come from the insert payload.

- [ ] **Step 5: Verify types compile**: `pnpm --filter web exec tsc --noEmit` (or `pnpm --filter web build` later; tsc is faster). Expected: no new errors.

---

### Task 2: `resolveCategoryId` — pure category matcher

**Files:**
- Create: `lib/receipts/resolveCategory.ts`
- Test: `__tests__/lib/receipts/resolveCategory.test.ts`

**Interfaces:**
- Produces: `resolveCategoryId(item: { history_category_id?: string | null; category?: string }, categories: Array<{ id: string; name: string }>): string | null`
- Priority: history id (if it exists in `categories`) → fuzzy name match (case-insensitive substring either direction, same logic as the old `matchCategory` in ReceiptUploader) → `null`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/receipts/resolveCategory.test.ts
import { describe, it, expect } from 'vitest'
import { resolveCategoryId } from '../../../lib/receipts/resolveCategory'

const cats = [
  { id: 'c1', name: 'Groceries' },
  { id: 'c2', name: 'Household' },
]

describe('resolveCategoryId', () => {
  it('prefers a history category id when it exists', () => {
    expect(resolveCategoryId({ history_category_id: 'c2', category: 'Groceries' }, cats)).toBe('c2')
  })

  it('ignores a history id that no longer exists and falls back to name match', () => {
    expect(resolveCategoryId({ history_category_id: 'gone', category: 'groceries' }, cats)).toBe('c1')
  })

  it('matches when the AI category contains the category name', () => {
    expect(resolveCategoryId({ category: 'Household chemicals' }, cats)).toBe('c2')
  })

  it('returns null when nothing matches', () => {
    expect(resolveCategoryId({ category: 'Electronics' }, cats)).toBeNull()
    expect(resolveCategoryId({}, cats)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/receipts/resolveCategory.test.ts`
Expected: FAIL — cannot resolve `lib/receipts/resolveCategory`.

- [ ] **Step 3: Implement**

```ts
// lib/receipts/resolveCategory.ts
/**
 * Pick a category id for a parsed receipt item without user input.
 * Priority: category-learning history match → fuzzy match of the AI's
 * category label against the user's categories → null (uncategorized).
 */
export function resolveCategoryId(
  item: { history_category_id?: string | null; category?: string },
  categories: Array<{ id: string; name: string }>,
): string | null {
  if (item.history_category_id && categories.some((c) => c.id === item.history_category_id)) {
    return item.history_category_id
  }
  const label = item.category?.toLowerCase().trim()
  if (!label) return null
  const match = categories.find((c) => {
    const name = c.name.toLowerCase()
    return name.includes(label) || label.includes(name)
  })
  return match?.id ?? null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/lib/receipts/resolveCategory.test.ts`
Expected: 4 passed.

- [ ] **Step 5: ~~Commit~~** Skipped (Global Constraints).

---

### Task 3: `autoSaveReceipt` — server-side save shared by background fn

**Files:**
- Create: `lib/receipts/autoSave.ts`
- Test: `__tests__/lib/receipts/autoSave.test.ts`

**Interfaces:**
- Consumes: `resolveCategoryId` from Task 2; `upsertCategoryLearning(supabase, userId, rawName, normalizedName, store, categoryId, isCorrection)` from `lib/supabase/queries/categoryLearning`.
- Produces: `autoSaveReceipt(supabase: SupabaseClient, userId: string, receipt: EnrichedReceipt): Promise<{ transactionId: string }>` — throws `Error` on insert failure. `EnrichedReceipt` = the object the background fn builds (`{ store, date, total, items: EnrichedItem[] }` where items carry the enrichment fields listed in `app/dashboard/receipts/upload/actions.ts`'s `ReviewedItem` plus `category` and `history_category_id`).

- [ ] **Step 1: Write the failing test** (chainable Supabase mock, mirroring `__tests__/netlify/ocr-process.test.ts` style)

```ts
// __tests__/lib/receipts/autoSave.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoSaveReceipt } from '../../../lib/receipts/autoSave'

const mockUpsertLearning = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../lib/supabase/queries/categoryLearning', () => ({
  upsertCategoryLearning: (...args: unknown[]) => mockUpsertLearning(...args),
}))

const mockTxInsert = vi.fn()
const mockItemsInsert = vi.fn()
const mockCategories = vi.fn()
const mockWallets = vi.fn()

function makeSupabase() {
  return {
    from: (table: string) => {
      if (table === 'transactions') {
        return { insert: (row: unknown) => ({ select: () => ({ single: () => mockTxInsert(row) }) }) }
      }
      if (table === 'receipt_items') {
        return { insert: (rows: unknown) => mockItemsInsert(rows) }
      }
      if (table === 'categories') {
        return { select: () => ({ eq: () => mockCategories() }) }
      }
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => mockWallets() }) }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as never
}

const receipt = {
  store: 'Biedronka',
  date: '2026-07-01',
  total: 10.48,
  items: [
    {
      name: 'Chleb', raw_name: 'CHLEB ZWYKLY', quantity: 1, unit_price: 3.49, total_price: 3.49,
      category: 'Bakery', confidence: 'high' as const, history_category_id: null,
    },
    {
      name: 'Mleko', raw_name: 'MLEKO 2%', quantity: 2, unit_price: 3.495, total_price: 6.99,
      category: 'Dairy', confidence: 'high' as const, history_category_id: 'c-dairy',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCategories.mockResolvedValue({
    data: [{ id: 'c-bakery', name: 'Bakery' }, { id: 'c-dairy', name: 'Dairy' }],
    error: null,
  })
  mockWallets.mockResolvedValue({ data: [{ id: 'w1' }], error: null })
  mockTxInsert.mockResolvedValue({ data: { id: 'tx1' }, error: null })
  mockItemsInsert.mockResolvedValue({ error: null })
})

describe('autoSaveReceipt', () => {
  it('saves a transaction with the oldest wallet and resolved categories', async () => {
    const result = await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(result.transactionId).toBe('tx1')
    expect(mockTxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', type: 'expense', amount: '10.48', wallet_id: 'w1', source: 'ocr' }),
    )
    const rows = mockItemsInsert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({ category_id: 'c-bakery', transaction_id: 'tx1' })
    expect(rows[1]).toMatchObject({ category_id: 'c-dairy' })
  })

  it('saves with wallet_id null when the user has no wallets', async () => {
    mockWallets.mockResolvedValue({ data: [], error: null })
    await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(mockTxInsert).toHaveBeenCalledWith(expect.objectContaining({ wallet_id: null }))
  })

  it('records category learning for categorized items', async () => {
    await autoSaveReceipt(makeSupabase(), 'u1', receipt)
    expect(mockUpsertLearning).toHaveBeenCalledTimes(2)
    expect(mockUpsertLearning).toHaveBeenCalledWith(
      expect.anything(), 'u1', 'CHLEB ZWYKLY', null, 'Biedronka', 'c-bakery', false,
    )
  })

  it('throws when the transaction insert fails', async () => {
    mockTxInsert.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(autoSaveReceipt(makeSupabase(), 'u1', receipt)).rejects.toThrow(/boom/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/lib/receipts/autoSave.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/receipts/autoSave.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertCategoryLearning } from '../supabase/queries/categoryLearning'
import { resolveCategoryId } from './resolveCategory'

export interface EnrichedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category?: string
  confidence: 'high' | 'low'
  raw_name?: string
  normalized_name?: string | null
  canonical_product_name?: string | null
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  flavor?: string | null
  variant?: string | null
  gtin?: string | null
  normalization_confidence?: number | null
  enrichment_confidence?: number | null
  normalization_source?: string | null
  enrichment_source?: string | null
  needs_review?: boolean
  product_fingerprint?: string | null
  history_category_id?: string | null
}

export interface EnrichedReceipt {
  store: string
  date: string
  total: number
  items: EnrichedItem[]
}

/**
 * Zero-touch save: insert the parsed receipt as an expense transaction with
 * receipt_items, categorized without user input. Used by the background OCR
 * function with a service-role client, so userId must be passed explicitly.
 * Throws on failure; caller marks the job as errored.
 */
export async function autoSaveReceipt(
  supabase: SupabaseClient,
  userId: string,
  receipt: EnrichedReceipt,
): Promise<{ transactionId: string }> {
  const [{ data: categories, error: catError }, { data: wallets, error: walletError }] =
    await Promise.all([
      supabase.from('categories').select('id, name').eq('user_id', userId),
      supabase
        .from('wallets')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1),
    ])
  if (catError) throw new Error(`categories lookup failed: ${catError.message}`)
  if (walletError) throw new Error(`wallet lookup failed: ${walletError.message}`)

  const userCategories = categories ?? []
  const walletId = wallets?.[0]?.id ?? null

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'expense',
      amount: String(receipt.total),
      merchant: receipt.store,
      date: receipt.date,
      wallet_id: walletId,
      source: 'ocr',
    })
    .select('id')
    .single()
  if (txError || !tx) throw new Error(`transaction insert failed: ${txError?.message}`)

  const itemRows = receipt.items.map((item) => ({
    transaction_id: tx.id,
    user_id: userId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: resolveCategoryId(item, userCategories),
    confidence: item.confidence,
    raw_name: item.raw_name ?? item.name,
    normalized_name: item.normalized_name ?? null,
    canonical_product_name: item.canonical_product_name ?? null,
    brand: item.brand ?? null,
    size_value: item.size_value ?? null,
    size_unit: item.size_unit ?? null,
    flavor: item.flavor ?? null,
    variant: item.variant ?? null,
    gtin: item.gtin ?? null,
    normalization_confidence: item.normalization_confidence ?? null,
    enrichment_confidence: item.enrichment_confidence ?? null,
    normalization_source: item.normalization_source ?? 'ocr',
    enrichment_source: item.enrichment_source ?? null,
    needs_review: item.needs_review ?? false,
    user_confirmed: false,
    product_fingerprint: item.product_fingerprint ?? null,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(itemRows)
  if (itemsError) throw new Error(`receipt_items insert failed: ${itemsError.message}`)

  // Passive learning: every auto-categorized item reinforces the mapping.
  await Promise.allSettled(
    receipt.items.map((item, i) => {
      const categoryId = itemRows[i].category_id
      if (!categoryId) return Promise.resolve()
      return upsertCategoryLearning(
        supabase,
        userId,
        item.raw_name ?? item.name,
        item.normalized_name ?? null,
        receipt.store || null,
        categoryId,
        false,
      )
    }),
  )

  return { transactionId: tx.id }
}
```

Note: `upsertCategoryLearning`'s existing signature must be checked at implementation time — copy the exact param order from `lib/supabase/queries/categoryLearning.ts` and adjust test + code if it differs.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/lib/receipts/autoSave.test.ts`
Expected: 4 passed.

- [ ] **Step 5: ~~Commit~~** Skipped.

---

### Task 4: Parse route accepts `autoSave`

**Files:**
- Modify: `app/api/receipts/parse/route.ts:46` (RequestSchema) and `:85-89` (job insert)
- Test: extend `__tests__/api/receipts-parse.test.ts`

**Interfaces:**
- Consumes: `auto_save` column (Task 1).
- Produces: `POST /api/receipts/parse` body `{ storagePath: string, autoSave?: boolean }`; job row inserted with `auto_save`.

- [ ] **Step 1: Add a failing test** to `__tests__/api/receipts-parse.test.ts` (follow the file's existing mock helpers — it already mocks the admin client's `insert`; assert on the inserted payload):

```ts
it('stores auto_save=true on the job when requested', async () => {
  // arrange using the file's existing happy-path helpers; capture the insert payload
  const res = await POST(makeRequest({ storagePath: `${VALID_USER_ID}/r.jpg`, autoSave: true }))
  expect(res.status).toBe(202)
  expect(capturedJobInsert).toMatchObject({ auto_save: true })
})
```

(Adapt names to the file's actual helpers at implementation time; the assertion — insert payload contains `auto_save: true`, and `false` by default — is the requirement.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts`
Expected: new test FAILS (payload lacks `auto_save`), existing tests PASS.

- [ ] **Step 3: Implement** in `app/api/receipts/parse/route.ts`:

```ts
const RequestSchema = z.object({
  storagePath: z.string().min(1).max(512),
  autoSave: z.boolean().optional().default(false),
})
```

and

```ts
const { storagePath, autoSave } = parseResult.data
// ...
.insert({ user_id: user.id, storage_path: storagePath, auto_save: autoSave })
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts`
Expected: all pass.

- [ ] **Step 5: ~~Commit~~** Skipped.

---

### Task 5: Background function auto-saves when `job.auto_save`

**Files:**
- Modify: `netlify/functions/ocr-process-background.ts` (job select `:49-53`, done-block `:212-224`)
- Test: extend `__tests__/netlify/ocr-process.test.ts`

**Interfaces:**
- Consumes: `autoSaveReceipt` (Task 3), `auto_save` column (Task 1).
- Produces: jobs with `auto_save=true` end `done` with `result.transaction_id: string`; on save failure job ends `error` with `error_code: 'SAVE_FAILED'`. Jobs with `auto_save=false` behave exactly as before.

- [ ] **Step 1: Add failing tests** to `__tests__/netlify/ocr-process.test.ts`:
  - mock `../../lib/receipts/autoSave` with `vi.mock` (`mockAutoSave`);
  - happy-path job select returns `auto_save: false` by default → assert `mockAutoSave` NOT called (existing tests keep passing once the select mock includes the new field);
  - new test: job select returns `auto_save: true` → expect `mockAutoSave` called with `(anything, VALID_USER_ID, objectContaining({ store: 'Biedronka' }))` and the done-update payload's `result` to contain `transaction_id`;
  - new test: `mockAutoSave` rejects → expect job update to `status: 'error', error_code: 'SAVE_FAILED'`.

```ts
const mockAutoSave = vi.fn()
vi.mock('../../lib/receipts/autoSave', () => ({
  autoSaveReceipt: (...args: unknown[]) => mockAutoSave(...args),
}))
// in tests:
mockAutoSave.mockResolvedValue({ transactionId: 'tx-1' })
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run __tests__/netlify/ocr-process.test.ts`
Expected: new tests FAIL (autoSave never called / result lacks transaction_id).

- [ ] **Step 3: Implement** in `ocr-process-background.ts`:

```ts
import { autoSaveReceipt } from '../../lib/receipts/autoSave'
// job select gains the column:
.select('id, user_id, storage_path, status, auto_save')
```

Replace the done-block (after `const result = { ...receipt, items: enrichedItems }`):

```ts
let transactionId: string | null = null
if (job.auto_save) {
  try {
    const saved = await autoSaveReceipt(supabase, job.user_id, result)
    transactionId = saved.transactionId
  } catch (err) {
    console.error('[ocr-bg] auto_save_error: jobId=%s', jobId, err)
    return failJob('SAVE_FAILED')
  }
}

const finalResult = transactionId ? { ...result, transaction_id: transactionId } : result

const { error: doneUpdateError } = await supabase
  .from('receipt_parse_jobs')
  .update({ status: 'done', result: finalResult, updated_at: new Date().toISOString() })
  .eq('id', jobId)
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run __tests__/netlify/ocr-process.test.ts`
Expected: all pass (update older mocks' job select to include `auto_save: false`).

- [ ] **Step 5: ~~Commit~~** Skipped.

---

### Task 6: Queries — monthly category breakdown + recent transactions

**Files:**
- Create: `lib/supabase/queries/categoryBreakdown.ts`
- Modify: `lib/supabase/queries/transactions.ts` (add optional `limit`)
- Test: `__tests__/lib/categoryBreakdown.test.ts` (pure aggregation helper only)

**Interfaces:**
- Produces:
  - `getMonthlyCategoryBreakdown(yearMonth: string): Promise<CategorySpend[]>` where `CategorySpend = { categoryId: string | null; name: string; color: string | null; total: number }`, expenses only, sorted desc by total, uncategorized bucketed as `{ categoryId: null, name: 'Other' }`.
  - exported pure helper `aggregateByCategory(rows: Array<{ amount: string; category: { id: string; name: string; color: string } | null }>): CategorySpend[]` (testable without Supabase).
  - `getTransactions(typeFilter?, limit?)` — unchanged behavior when `limit` omitted.

- [ ] **Step 1: Failing test for the aggregation helper**

```ts
// __tests__/lib/categoryBreakdown.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateByCategory } from '../../lib/supabase/queries/categoryBreakdown'

describe('aggregateByCategory', () => {
  it('sums per category, buckets null as Other, sorts desc', () => {
    const rows = [
      { amount: '10.00', category: { id: 'c1', name: 'Groceries', color: '#0f0' } },
      { amount: '5.50', category: { id: 'c1', name: 'Groceries', color: '#0f0' } },
      { amount: '99.99', category: null },
      { amount: '20.00', category: { id: 'c2', name: 'Transport', color: '#00f' } },
    ]
    const out = aggregateByCategory(rows)
    expect(out).toEqual([
      { categoryId: null, name: 'Other', color: null, total: 99.99 },
      { categoryId: 'c2', name: 'Transport', color: '#00f', total: 20 },
      { categoryId: 'c1', name: 'Groceries', color: '#0f0', total: 15.5 },
    ])
  })
})
```

- [ ] **Step 2: Run to verify failure**: `pnpm --filter web exec vitest run __tests__/lib/categoryBreakdown.test.ts` → module not found.

- [ ] **Step 3: Implement**

```ts
// lib/supabase/queries/categoryBreakdown.ts
import { createClient } from '@/lib/supabase/server'

export interface CategorySpend {
  categoryId: string | null
  name: string
  color: string | null
  total: number
}

type BreakdownRow = {
  amount: string
  category: { id: string; name: string; color: string } | null
}

export function aggregateByCategory(rows: BreakdownRow[]): CategorySpend[] {
  const buckets = new Map<string | null, CategorySpend>()
  for (const row of rows) {
    const key = row.category?.id ?? null
    const existing = buckets.get(key)
    const amount = Number(row.amount)
    if (existing) {
      existing.total += amount
    } else {
      buckets.set(key, {
        categoryId: key,
        name: row.category?.name ?? 'Other',
        color: row.category?.color ?? null,
        total: amount,
      })
    }
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total)
}

/**
 * Current-month expense totals grouped by category. Uncategorized spending
 * is bucketed as "Other". RLS scopes rows to the current user.
 */
export async function getMonthlyCategoryBreakdown(yearMonth: string): Promise<CategorySpend[]> {
  const supabase = await createClient()
  const [year, month] = yearMonth.split('-').map(Number)
  const first = `${yearMonth}-01`
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category:categories(id, name, color)')
    .eq('type', 'expense')
    .gte('date', first)
    .lte('date', last)

  if (error) throw new Error(`Failed to load category breakdown: ${error.message}`)
  return aggregateByCategory((data ?? []) as unknown as BreakdownRow[])
}
```

(Compare month-bounds logic with `lib/supabase/queries/metrics.ts`'s `monthBounds` at implementation time and reuse/extract it if it's exported; otherwise keep this local copy consistent with it.)

- [ ] **Step 4: Run to verify pass**: same command → 1 passed.

- [ ] **Step 5: Add `limit` param to `getTransactions`** in `lib/supabase/queries/transactions.ts`:

```ts
export async function getTransactions(
  typeFilter?: TransactionType,
  limit?: number,
): Promise<TransactionWithCategory[]> {
  // ...existing query build...
  if (typeFilter) query = query.eq('type', typeFilter)
  if (limit) query = query.limit(limit)
```

- [ ] **Step 6: Typecheck**: `pnpm --filter web exec tsc --noEmit`. Expected: clean.

- [ ] **Step 7: ~~Commit~~** Skipped.

---

### Task 7: QuickUpload component

**Files:**
- Create: `components/receipts/QuickUpload.tsx`

**Interfaces:**
- Consumes: `POST /api/receipts/parse` with `{ storagePath, autoSave: true }` (Task 4), `GET /api/receipts/jobs/[id]` polling (unchanged).
- Produces: `<QuickUpload />` client component, no props. Reuse upload mechanics (Storage upload path `{userId}/{uuid}.{ext}`, accepted mime types, Bearer token via `supabase.auth.getSession()`) from the current `components/receipts/ReceiptUploader.tsx` before deleting it in Task 9.

- [ ] **Step 1: Implement** (no unit test — client component, node-env Vitest can't render it; verified via build + e2e):

Requirements:
- One dropzone card: drag-and-drop + click-to-pick + `capture` attribute for phone cameras; `accept` = jpeg/png/webp/pdf/txt/csv (copy `EXT_MAP` + size checks from ReceiptUploader).
- States: `idle → uploading → processing → saved | failed` shown inline in the card; multiple sequential uploads allowed (state resets on new pick).
- Upload to bucket `receipts` at `${user.id}/${crypto.randomUUID()}.${ext}`, then POST parse with `autoSave: true`, then poll `/api/receipts/jobs/{jobId}` every 2.5s (cap ~3 min; job stall handling already server-side).
- On `done`: show "Saved ✓ {store} · {total} zł" and call `router.refresh()` so dashboard numbers update.
- On `error`: map `errorCode` to human text (`SAVE_FAILED` → "Parsed but couldn't save — try again"); offer retry by letting the user pick the file again.
- Styling: match dashboard card idiom (`rounded-xl border border-zinc-200 bg-white p-5 dark:...`), prominent but not huge.

- [ ] **Step 2: Verify it compiles**: `pnpm --filter web exec tsc --noEmit`. Expected: clean.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 8: Dashboard rewrite — expenses & income focus

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `QuickUpload` (Task 7), `getMonthlyMetrics`, `getUserWalletsWithBalances` + `fetchRatesFromEUR`/`convertToPLN` (balance card only), `getMonthlyCategoryBreakdown` (Task 6), `getTransactions(undefined, 10)` (Task 6).

- [ ] **Step 1: Rewrite the page** with sections, top to bottom:
  1. `<QuickUpload />` — the primary action.
  2. Three metric cards (reuse existing card markup): Monthly Income (green), Monthly Expenses (red), Total Balance (existing wallet-sum logic incl. credit-card subtraction and multi-currency hint). Drop the Savings Rate card.
  3. "Where it went" — category breakdown list: for each `CategorySpend`, a row with name, a horizontal bar (width = share of max, inline style `width: pct%`, background from `color` or zinc fallback), and the PLN amount. Empty state: "No expenses yet this month."
  4. "Recent transactions" — last 10: date, merchant/description, category badge (plain, non-interactive), signed amount (green income / red expense); "View all →" link to `/dashboard/transactions`.
  - Remove: wallets grid, upload-shortcut banner, top-products section, `getTopProducts` import.

- [ ] **Step 2: Verify**: `pnpm --filter web exec tsc --noEmit` then `pnpm --filter web dev` — load `/dashboard`, confirm sections render with real data.

- [ ] **Step 3: ~~Commit~~** Skipped.

---

### Task 9: Remove categories UI, receipts pages, simplify nav

**Files:**
- Delete: `app/dashboard/receipts/` (whole dir), `components/receipts/ReceiptUploader.tsx`, `app/dashboard/settings/categories/` (whole dir), `components/categories/` (whole dir)
- Modify: `components/layout/Sidebar.tsx` (nav items), `components/transactions/TransactionForm.tsx` (drop category picker), `app/dashboard/transactions/new/page.tsx` + `app/dashboard/transactions/[id]/edit/page.tsx` (stop passing categories), `lib/actions/transactions.ts` if it validates `category_id` as required (keep accepting null)
- Keep: `lib/actions/categories.ts` deletion **only if** nothing else imports it — check with grep first; registration seeding must keep working.

**Interfaces:**
- Consumes: nothing new. Produces: nav = Overview, Transactions, Wallets, Security (wallets stay reachable; receipts + categories links gone).

- [ ] **Step 1: Grep for references before deleting**

Run: `grep -rn "receipts/upload\|ReceiptUploader\|settings/categories\|components/categories\|actions/categories" apps/web --include="*.ts" --include="*.tsx" -l`
Update every hit: sidebar links, dashboard links, any tests.

- [ ] **Step 2: Delete the files/dirs listed above.** In `Sidebar.tsx` remove the Receipts and Categories nav items (keep Overview, Wallets, Transactions, Security).

- [ ] **Step 3: TransactionForm** — remove the category `<select>` block (`components/transactions/TransactionForm.tsx:295-325` area), the `categoryTree` computation, the `categories` prop, and `defaultCategoryId`. Form submits without `category_id`; server action saves `category_id: null`. Check `lib/actions/transactions.ts` zod schema treats `category_id` as optional/nullable — adjust if it errors on absence. Update `transactions/new/page.tsx` and `transactions/[id]/edit/page.tsx` to stop fetching/passing categories.

- [ ] **Step 4: Tests** — delete or update specs that reference removed routes (`__tests__/e2e/ocr-api.spec.ts` may POST parse directly — keep if API-only; check `transactions.spec.ts` for category-picker interactions and update).

- [ ] **Step 5: Verify**: `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`. Expected: clean.

- [ ] **Step 6: ~~Commit~~** Skipped.

---

### Task 10: Full verification

- [ ] **Step 1:** `pnpm --filter web exec vitest run` — all unit tests pass.
- [ ] **Step 2:** `pnpm --filter web lint` — clean.
- [ ] **Step 3:** `pnpm --filter web build` — succeeds.
- [ ] **Step 4:** Manual smoke via `pnpm --filter web dev`: dashboard renders; upload a sample receipt image end-to-end if `ANTHROPIC_API_KEY` is configured locally (otherwise verify the job is created and note the limitation).
- [ ] **Step 5:** Report: what changed, what was verified, migration 017 status, and the open decisions from the spec (auto-save vs confirm; category correction UI follow-up).

# Category Auto-Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill receipt item categories from the user's own history, show a "from history" badge in the review screen, and re-learn every time the user saves (corrections weighted 20× over passive confirmations).

**Architecture:** Two Postgres RPC functions handle all matching logic (`lookup_category_from_history` — tiered exact→fuzzy, `upsert_category_learning` — weighted upsert). The OCR background function calls the lookup after normalization; the save action calls the upsert. The review UI tracks whether the user changed a category and passes that flag to the save action.

**Tech Stack:** PostgreSQL 15 (pg_trgm), Supabase RPC, TypeScript, Next.js Server Actions, Vitest

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/016_category_learning.sql` |
| Create | `supabase/migrations/016_category_learning_down.sql` |
| Create | `apps/web/lib/supabase/queries/categoryLearning.ts` |
| Create | `apps/web/__tests__/lib/categoryLearning.test.ts` |
| Modify | `apps/web/lib/ocr/receiptSchema.ts` |
| Modify | `apps/web/netlify/functions/ocr-process-background.ts` |
| Modify | `apps/web/__tests__/netlify/ocr-process.test.ts` |
| Modify | `apps/web/app/dashboard/receipts/upload/actions.ts` |
| Modify | `apps/web/components/receipts/ReceiptUploader.tsx` |

---

## Task 1: Migration — pg_trgm + GiST index + RPC functions

**Files:**
- Create: `supabase/migrations/016_category_learning.sql`
- Create: `supabase/migrations/016_category_learning_down.sql`

- [ ] **Step 1: Write `016_category_learning.sql`**

```sql
-- 016_category_learning.sql
-- Tiered category lookup and weighted learning RPCs for receipt items.

-- 1. pg_trgm for fuzzy name matching (Tier 4 fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GiST index for fast similarity search on per-user name mappings
CREATE INDEX idx_user_name_mappings_normalized_trgm
  ON public.receipt_item_name_mappings
  USING GIST (normalized_name gist_trgm_ops)
  WHERE normalized_name IS NOT NULL;

-- 3. Lookup: tiered match returning best category for a product name.
--    Tier 1 — exact raw_name + retailer (most specific)
--    Tier 2 — exact raw_name, any retailer
--    Tier 3 — exact normalized_name
--    Tier 4 — trigram similarity > 0.65 on normalized_name
--    Returns the first match ordered by tier, then confidence DESC.
CREATE OR REPLACE FUNCTION public.lookup_category_from_history(
  p_user_id         uuid,
  p_raw_name        text,
  p_normalized_name text,
  p_retailer        text DEFAULT NULL
)
RETURNS TABLE (category_id uuid, confidence numeric, tier int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category_id, confidence, tier
  FROM (
    SELECT m.category_id, m.confidence, 1 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.raw_name = upper(p_raw_name)
      AND m.retailer IS NOT DISTINCT FROM p_retailer
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id, m.confidence, 2 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.raw_name = upper(p_raw_name)
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id, m.confidence, 3 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.normalized_name = p_normalized_name
      AND m.category_id IS NOT NULL

    UNION ALL

    SELECT m.category_id,
           m.confidence * similarity(m.normalized_name, p_normalized_name) AS confidence,
           4 AS tier
    FROM public.receipt_item_name_mappings m
    WHERE m.user_id = p_user_id
      AND m.category_id IS NOT NULL
      AND p_normalized_name IS NOT NULL
      AND m.normalized_name IS NOT NULL
      AND similarity(m.normalized_name, p_normalized_name) > 0.65
  ) sub
  ORDER BY tier, confidence DESC
  LIMIT 1;
$$;

-- 4. Upsert: weighted learning.
--    Correction (p_is_correction=true):  confidence → 1.0, source → 'user'
--    Passive save (p_is_correction=false): confidence += 0.05 (max 0.95), usage_count++
CREATE OR REPLACE FUNCTION public.upsert_category_learning(
  p_user_id         uuid,
  p_raw_name        text,
  p_normalized_name text,
  p_retailer        text,
  p_category_id     uuid,
  p_is_correction   boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.receipt_item_name_mappings
    (user_id, raw_name, normalized_name, retailer, category_id, confidence, source, usage_count)
  VALUES (
    p_user_id,
    upper(p_raw_name),
    p_normalized_name,
    p_retailer,
    p_category_id,
    CASE WHEN p_is_correction THEN 1.0 ELSE 0.6 END,
    CASE WHEN p_is_correction THEN 'user' ELSE 'ai' END,
    1
  )
  ON CONFLICT (user_id, retailer, raw_name) DO UPDATE
    SET category_id  = p_category_id,
        confidence   = CASE
                         WHEN p_is_correction THEN 1.0
                         ELSE LEAST(receipt_item_name_mappings.confidence + 0.05, 0.95)
                       END,
        source       = CASE
                         WHEN p_is_correction THEN 'user'
                         ELSE receipt_item_name_mappings.source
                       END,
        usage_count  = receipt_item_name_mappings.usage_count + 1,
        last_used_at = now(),
        updated_at   = now();
END;
$$;
```

- [ ] **Step 2: Write `016_category_learning_down.sql`**

```sql
-- 016_category_learning_down.sql
DROP FUNCTION IF EXISTS public.upsert_category_learning(uuid,text,text,text,uuid,boolean);
DROP FUNCTION IF EXISTS public.lookup_category_from_history(uuid,text,text,text);
DROP INDEX IF EXISTS public.idx_user_name_mappings_normalized_trgm;
-- pg_trgm extension intentionally NOT dropped — may be used elsewhere.
```

- [ ] **Step 3: Apply migration via Supabase dashboard or CLI**

```bash
# Via CLI (if configured):
supabase db push
# Or paste 016_category_learning.sql into the Supabase SQL editor and run it.
```

Expected: no errors, two new functions visible in Supabase → Database → Functions.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_category_learning.sql supabase/migrations/016_category_learning_down.sql
git commit -m "feat(db): add category learning RPCs with pg_trgm tiered lookup"
```

---

## Task 2: TypeScript helper + unit tests

**Files:**
- Create: `apps/web/lib/supabase/queries/categoryLearning.ts`
- Create: `apps/web/__tests__/lib/categoryLearning.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/__tests__/lib/categoryLearning.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  lookupCategoryFromHistory,
  upsertCategoryLearning,
} from '@/lib/supabase/queries/categoryLearning'
import type { SupabaseClient } from '@supabase/supabase-js'

const CATEGORY_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeSupabase(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as unknown as SupabaseClient
}

describe('lookupCategoryFromHistory', () => {
  it('returns null when RPC returns empty array', async () => {
    const sb = makeSupabase({ data: [], error: null })
    expect(await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka')).toBeNull()
  })

  it('returns null when RPC errors', async () => {
    const sb = makeSupabase({ data: null, error: new Error('rpc failed') })
    expect(await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', null)).toBeNull()
  })

  it('returns the first match', async () => {
    const sb = makeSupabase({
      data: [{ category_id: CATEGORY_UUID, confidence: 0.9, tier: 1 }],
      error: null,
    })
    const result = await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka')
    expect(result).toEqual({ category_id: CATEGORY_UUID, confidence: 0.9, tier: 1 })
  })

  it('passes null retailer to RPC', async () => {
    const sb = makeSupabase({ data: [], error: null })
    await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', null)
    expect(sb.rpc).toHaveBeenCalledWith(
      'lookup_category_from_history',
      expect.objectContaining({ p_retailer: null }),
    )
  })

  it('passes null normalized_name to RPC when null provided', async () => {
    const sb = makeSupabase({ data: [], error: null })
    await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', null, null)
    expect(sb.rpc).toHaveBeenCalledWith(
      'lookup_category_from_history',
      expect.objectContaining({ p_normalized_name: null }),
    )
  })
})

describe('upsertCategoryLearning', () => {
  it('calls RPC with p_is_correction=true for corrections', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka', CATEGORY_UUID, true)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_is_correction: true, p_category_id: CATEGORY_UUID }),
    )
  })

  it('calls RPC with p_is_correction=false for passive saves', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'MLEKO', 'mleko', null, CATEGORY_UUID, false)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_is_correction: false }),
    )
  })

  it('uppercases raw_name before passing to RPC', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'mleko', 'mleko', null, CATEGORY_UUID, false)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_raw_name: 'MLEKO' }),
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter web exec vitest run __tests__/lib/categoryLearning.test.ts
```

Expected: `Cannot find module '@/lib/supabase/queries/categoryLearning'`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/lib/supabase/queries/categoryLearning.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CategoryHistoryMatch {
  category_id: string
  confidence: number
  tier: number
}

export async function lookupCategoryFromHistory(
  supabase: SupabaseClient,
  userId: string,
  rawName: string,
  normalizedName: string | null,
  retailer: string | null,
): Promise<CategoryHistoryMatch | null> {
  const { data, error } = await supabase.rpc('lookup_category_from_history', {
    p_user_id: userId,
    p_raw_name: rawName,
    p_normalized_name: normalizedName ?? null,
    p_retailer: retailer ?? null,
  })
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null
  const row = Array.isArray(data) ? data[0] : data
  return row as CategoryHistoryMatch
}

export async function upsertCategoryLearning(
  supabase: SupabaseClient,
  userId: string,
  rawName: string,
  normalizedName: string | null,
  retailer: string | null,
  categoryId: string,
  isCorrection: boolean,
): Promise<void> {
  await supabase.rpc('upsert_category_learning', {
    p_user_id: userId,
    p_raw_name: rawName.toUpperCase(),
    p_normalized_name: normalizedName ?? null,
    p_retailer: retailer ?? null,
    p_category_id: categoryId,
    p_is_correction: isCorrection,
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter web exec vitest run __tests__/lib/categoryLearning.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase/queries/categoryLearning.ts apps/web/__tests__/lib/categoryLearning.test.ts
git commit -m "feat(learning): add lookupCategoryFromHistory and upsertCategoryLearning helpers"
```

---

## Task 3: Extend receiptSchema with history fields

**Files:**
- Modify: `apps/web/lib/ocr/receiptSchema.ts`

- [ ] **Step 1: Add history fields to `ReceiptItemSchema`**

Replace the current `ReceiptItemSchema` definition in `apps/web/lib/ocr/receiptSchema.ts`:

```typescript
import { z } from 'zod'

export const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().default(1),
  unit_price: z.number(),
  total_price: z.number(),
  category: z.string(),
  confidence: z.enum(['high', 'low']),
  // Populated by normalization pipeline after OCR
  raw_name: z.string().optional(),
  normalized_name: z.string().optional(),
  // Populated by category history lookup after normalization
  history_category_id: z.string().uuid().nullable().optional(),
  history_category_confidence: z.number().nullable().optional(),
})

export const ParsedReceiptSchema = z.object({
  store: z.string(),
  date: z.string(),
  items: z.array(ReceiptItemSchema),
  total: z.number(),
  confidence: z.enum(['high', 'low']),
  discrepancy_warning: z.boolean().optional(),
})

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>
```

- [ ] **Step 2: Run existing unit tests — expect still PASS**

```bash
pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts __tests__/netlify/ocr-process.test.ts
```

Expected: all tests pass (new fields are optional, no breakage).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ocr/receiptSchema.ts
git commit -m "feat(schema): add history_category_id and history_category_confidence to ReceiptItemSchema"
```

---

## Task 4: OCR background function — call history lookup after normalization

**Files:**
- Modify: `apps/web/netlify/functions/ocr-process-background.ts`
- Modify: `apps/web/__tests__/netlify/ocr-process.test.ts`

- [ ] **Step 1: Extend the mock in `ocr-process.test.ts` to support `rpc`**

Add `mockRpc` alongside existing mocks at the top of the test file, and wire it into the `createClient` mock. Replace the existing `vi.mock('@supabase/supabase-js', ...)` block:

```typescript
const mockGetUser = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockMessagesCreate = vi.fn()
const mockJobSelect = vi.fn()
const mockJobUpdate = vi.fn()
const mockRpc = vi.fn()   // ADD THIS

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
    rpc: mockRpc,           // ADD THIS
    from: (table: string) => {
      if (table === 'receipt_parse_jobs') {
        return {
          select: () => ({ eq: () => ({ single: mockJobSelect }) }),
          update: (data: unknown) => {
            const chain: Record<string, unknown> = {
              _data: data,
              eq: () => chain,
              select: () => chain,
              single: () => Promise.resolve({ data: { id: VALID_JOB_ID }, error: null }),
            }
            return chain
          },
        }
      }
      return {}
    },
  }),
}))
```

Also add `mockRpc.mockResolvedValue({ data: [], error: null })` inside `setupHappyPath()`:

```typescript
function setupHappyPath() {
  mockJobSelect.mockResolvedValue({
    data: { id: VALID_JOB_ID, user_id: VALID_USER_ID, storage_path: VALID_STORAGE_PATH, status: 'pending' },
    error: null,
  })
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example.com/signed' },
    error: null,
  })
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => Buffer.from('fake-image-data'),
    headers: { get: () => 'image/jpeg' },
  })
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(VALID_CLAUDE_RESPONSE) }],
    stop_reason: 'end_turn',
  })
  mockPdfParse.mockResolvedValue({ text: '' })
  mockRpc.mockResolvedValue({ data: [], error: null })   // ADD THIS
}
```

Add one new test at the end of `describe('processOcrJob', ...)`:

```typescript
it('calls lookup_category_from_history for each item after normalization', async () => {
  setupHappyPath()
  mockRpc.mockResolvedValue({ data: [{ category_id: 'cat-uuid', confidence: 0.9, tier: 1 }], error: null })
  await processOcrJob(VALID_JOB_ID)
  expect(mockRpc).toHaveBeenCalledWith('lookup_category_from_history', expect.objectContaining({
    p_user_id: VALID_USER_ID,
  }))
})
```

- [ ] **Step 2: Run tests — expect the new test to FAIL**

```bash
pnpm --filter web exec vitest run __tests__/netlify/ocr-process.test.ts
```

Expected: existing tests pass, new test fails with `mockRpc not called`.

- [ ] **Step 3: Add import and history lookup to `ocr-process-background.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { lookupCategoryFromHistory } from '../../lib/supabase/queries/categoryLearning'
```

Inside the `receipt.items.map(async (item) => { ... })` block in `processOcrJob`, replace the `return { ...item, ... }` statement (currently ending at line ~194) with:

```typescript
      const historyMatch = await lookupCategoryFromHistory(
        supabase,
        job.user_id,
        norm.rawName,
        norm.normalizedName,
        receipt.store ?? null,
      )

      return {
        ...item,
        raw_name: norm.rawName,
        normalized_name: norm.normalizedName,
        canonical_product_name: enrichment?.canonical_product_name ?? norm.canonical_product_name,
        brand: enrichment?.brand ?? null,
        size_value: norm.attributes.size_value,
        size_unit: norm.attributes.size_unit,
        flavor: norm.attributes.flavor,
        variant: norm.attributes.variant,
        gtin: enrichment?.gtin ?? null,
        normalization_confidence: norm.confidence,
        enrichment_confidence: enrichment?.confidence ?? null,
        normalization_source: norm.source,
        enrichment_source: enrichment?.source ?? null,
        needs_review: norm.needs_review,
        product_fingerprint: norm.fingerprint,
        history_category_id: historyMatch?.category_id ?? null,
        history_category_confidence: historyMatch?.confidence ?? null,
      }
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
pnpm --filter web exec vitest run __tests__/netlify/ocr-process.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/netlify/functions/ocr-process-background.ts apps/web/__tests__/netlify/ocr-process.test.ts
git commit -m "feat(ocr): attach category history match to each enriched receipt item"
```

---

## Task 5: `saveReceipt` action — write category to learning table

**Files:**
- Modify: `apps/web/app/dashboard/receipts/upload/actions.ts`

- [ ] **Step 1: Update `ReviewedItem` and replace the partial upsert**

Full replacement of `apps/web/app/dashboard/receipts/upload/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { upsertCategoryLearning } from '@/lib/supabase/queries/categoryLearning'

export interface ReviewedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string | null
  confidence: 'high' | 'low'
  raw_name?: string
  normalized_name?: string | null
  canonical_product_name?: string | null
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  flavor?: string | null
  variant?: string | null
  barcode?: string | null
  gtin?: string | null
  normalization_confidence?: number | null
  enrichment_confidence?: number | null
  normalization_source?: string | null
  enrichment_source?: string | null
  needs_review?: boolean
  user_confirmed?: boolean
  product_fingerprint?: string | null
  // Category learning fields
  history_category_id?: string | null
  user_changed_category?: boolean
}

export interface SaveReceiptInput {
  store: string
  date: string
  wallet_id: string | null
  total: number
  items: ReviewedItem[]
}

export async function saveReceipt(
  input: SaveReceiptInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'expense',
      amount: String(input.total),
      merchant: input.store,
      date: input.date,
      wallet_id: input.wallet_id || null,
      source: 'ocr',
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return { error: `Failed to save transaction: ${txError?.message}` }
  }

  const rows = input.items.map((item) => ({
    transaction_id: tx.id,
    user_id: user.id,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: item.category_id || null,
    confidence: item.confidence,
    raw_name: item.raw_name ?? item.name,
    normalized_name: item.normalized_name ?? null,
    canonical_product_name: item.canonical_product_name ?? null,
    brand: item.brand ?? null,
    size_value: item.size_value ?? null,
    size_unit: item.size_unit ?? null,
    flavor: item.flavor ?? null,
    variant: item.variant ?? null,
    barcode: item.barcode ?? null,
    gtin: item.gtin ?? null,
    normalization_confidence: item.normalization_confidence ?? null,
    enrichment_confidence: item.enrichment_confidence ?? null,
    normalization_source: item.normalization_source ?? 'ocr',
    enrichment_source: item.enrichment_source ?? null,
    needs_review: item.needs_review ?? false,
    user_confirmed: item.user_confirmed ?? false,
    product_fingerprint: item.product_fingerprint ?? null,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(rows)
  if (itemsError) {
    return { error: `Failed to save items: ${itemsError.message}` }
  }

  // Category learning: upsert for every item that has a raw_name and a category.
  // Corrections (user_changed_category=true) are weighted higher than passive saves.
  const learningItems = input.items.filter(
    (item) => item.category_id && (item.raw_name ?? item.name),
  )
  await Promise.all(
    learningItems.map((item) =>
      upsertCategoryLearning(
        supabase,
        user.id,
        item.raw_name ?? item.name,
        item.normalized_name ?? null,
        input.store || null,
        item.category_id!,
        item.user_changed_category === true,
      ),
    ),
  )

  return {}
}
```

- [ ] **Step 2: Run unit tests**

```bash
pnpm --filter web exec vitest run __tests__/lib/categoryLearning.test.ts
pnpm --filter web exec vitest run __tests__/api/receipts-parse.test.ts
```

Expected: all pass (actions.ts has no direct unit test; covered indirectly via e2e).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/receipts/upload/actions.ts
git commit -m "feat(actions): write category_id to learning table on every receipt save"
```

---

## Task 6: ReceiptUploader UI — track category changes + "from history" badge

**Files:**
- Modify: `apps/web/components/receipts/ReceiptUploader.tsx`

- [ ] **Step 1: Add `history_category_id` and `history_category_confidence` to `ParsedItem`**

In the `ParsedItem` interface (around line 22), add two fields:

```typescript
interface ParsedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
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
  history_category_id?: string | null           // ADD
  history_category_confidence?: number | null   // ADD
}
```

- [ ] **Step 2: Add `history_category_id` and `user_changed_category` to `ReviewItem`**

In the `ReviewItem` interface (around line 49), add two fields:

```typescript
interface ReviewItem {
  display_name: string
  raw_name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string
  confidence: 'high' | 'low'
  normalized_name: string | null
  canonical_product_name: string | null
  brand: string | null
  size_value: number | null
  size_unit: string | null
  flavor: string | null
  variant: string | null
  gtin: string | null
  normalization_confidence: number | null
  enrichment_confidence: number | null
  normalization_source: string | null
  enrichment_source: string | null
  needs_review: boolean
  product_fingerprint: string | null
  history_category_id: string | null      // ADD
  user_changed_category: boolean          // ADD
}
```

- [ ] **Step 3: Populate new fields when building review state**

In `processFile`, inside the `setReview` call where items are mapped (around line 241), add the two new fields to the returned object:

```typescript
items: receipt.items.map((item) => {
  const raw = item.raw_name ?? item.name
  const displayName = item.canonical_product_name ?? item.normalized_name ?? item.name
  const initialCategoryId = item.history_category_id
    ? item.history_category_id                        // prefer history match
    : matchCategory(item.category, categories)        // fall back to OCR text guess
  return {
    display_name: displayName,
    raw_name: raw,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: initialCategoryId,
    confidence: item.confidence,
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
    normalization_source: item.normalization_source ?? null,
    enrichment_source: item.enrichment_source ?? null,
    needs_review: item.needs_review ?? false,
    product_fingerprint: item.product_fingerprint ?? null,
    history_category_id: item.history_category_id ?? null,   // ADD
    user_changed_category: false,                             // ADD
  }
}),
```

- [ ] **Step 4: Track category changes in `updateItem`**

Replace the current `updateItem` callback:

```typescript
const updateItem = useCallback((index: number, patch: Partial<ReviewItem>) => {
  setReview((prev) => {
    if (!prev) return prev
    const items = [...prev.items]
    const current = items[index]
    if (patch.category_id !== undefined) {
      patch.user_changed_category = patch.category_id !== current.history_category_id
    }
    items[index] = { ...current, ...patch }
    return { ...prev, items }
  })
}, [])
```

- [ ] **Step 5: Add "from history" badge in the category column**

In the review table body, find the `<td>` that contains the category `<select>` (around line 535). Replace it with:

```tsx
<td className="px-4 py-2.5">
  <select
    value={item.category_id}
    onChange={(e) => updateItem(i, { category_id: e.target.value })}
    className="w-full rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  >
    <option value="">— uncategorised —</option>
    {categories.map((c) => (
      <option key={c.id} value={c.id}>{c.name}</option>
    ))}
  </select>
  {item.history_category_id && !item.user_changed_category && (
    <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">
      from history
    </span>
  )}
</td>
```

- [ ] **Step 6: Pass new fields through `handleSave`**

In `handleSave`, inside the `items.map(...)` call, add the two new fields:

```typescript
items: review.items.map((item) => ({
  name: item.display_name,
  quantity: item.quantity,
  unit_price: item.unit_price,
  total_price: item.total_price,
  category_id: item.category_id || null,
  confidence: item.confidence,
  raw_name: item.raw_name,
  normalized_name: item.normalized_name,
  canonical_product_name: item.canonical_product_name,
  brand: item.brand,
  size_value: item.size_value,
  size_unit: item.size_unit,
  flavor: item.flavor,
  variant: item.variant,
  gtin: item.gtin,
  normalization_confidence: item.normalization_confidence,
  enrichment_confidence: item.enrichment_confidence,
  normalization_source: item.normalization_source,
  enrichment_source: item.enrichment_source,
  product_fingerprint: item.product_fingerprint,
  needs_review: false,
  user_confirmed: item.normalized_name !== null || item.user_changed_category,
  history_category_id: item.history_category_id,       // ADD
  user_changed_category: item.user_changed_category,   // ADD
})),
```

- [ ] **Step 7: Type-check and lint**

```bash
pnpm --filter web lint
```

Expected: no errors.

- [ ] **Step 8: Run full unit test suite**

```bash
pnpm --filter web exec vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/receipts/ReceiptUploader.tsx
git commit -m "feat(ui): track category changes and show 'from history' badge in receipt review"
```

---

## Task 7: Smoke test end-to-end

- [ ] **Step 1: Start dev server**

```bash
pnpm --filter web dev
```

- [ ] **Step 2: Upload a receipt you have uploaded before**

Open `http://localhost:3000/dashboard/receipts/upload`. Upload a receipt from a store you have scanned previously. In the review screen, verify:
- Items that were previously categorised show "from history" below their category dropdown
- The pre-selected category matches what you set last time
- Changing the category makes the "from history" badge disappear

- [ ] **Step 3: Save and re-upload the same receipt**

Save the receipt. Upload the same receipt again. Verify all items now show "from history" (because the passive save bumped `usage_count`).

- [ ] **Step 4: Change a category and re-upload**

On the second review, change one item's category. Save. Upload the receipt a third time. Verify that the corrected item now shows the new category "from history" (correction was weighted higher).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: category auto-learning from history with weighted re-learning"
```

# Income Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `type` column (`expense | income | any`) to the `categories` table so the transaction form shows only categories relevant to the selected transaction type.

**Architecture:** A single SQL migration adds the column, backfills the 12 existing system categories as `expense` (with 2 set to `any`), and seeds 6 new income system categories. TypeScript types are updated in both apps. A new shared Zod schema in `lib/schemas/category.ts` (web) drives validation. The web `TransactionForm` and mobile `TransactionForm` filter their category picker based on the current transaction type. The web `CategoryForm` gains a type radio group so users can assign new/edited categories to a type.

**Tech Stack:** Supabase PostgreSQL, TypeScript, Zod, Next.js 16 Server Actions, React, Expo/React Native

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/005_category_type.sql` |
| Create | `supabase/migrations/005_category_type_down.sql` |
| Create | `apps/web/lib/schemas/category.ts` |
| Create | `apps/web/__tests__/api/category-schema.test.ts` |
| Modify | `apps/web/types/database.ts` |
| Modify | `apps/mobile/types/database.ts` |
| Modify | `apps/web/lib/actions/categories.ts` |
| Modify | `apps/web/components/categories/CategoryForm.tsx` |
| Modify | `apps/web/components/categories/CategoryList.tsx` |
| Modify | `apps/web/components/transactions/TransactionForm.tsx` |
| Modify | `apps/mobile/hooks/useCategories.ts` |
| Modify | `apps/mobile/components/transactions/TransactionForm.tsx` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/005_category_type.sql`
- Create: `supabase/migrations/005_category_type_down.sql`

- [ ] **Step 1: Write `005_category_type.sql`**

```sql
-- Migration: 005_category_type
-- Description: Add type column to categories ('expense' | 'income' | 'any').
-- Backfills existing 10 expense-only system categories, sets 2 to 'any',
-- and seeds 6 new income system categories.

-- 1. Add column with DEFAULT so existing rows get 'expense'
ALTER TABLE public.categories
  ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
    CHECK (type IN ('expense', 'income', 'any'));

-- 2. Two system categories belong to both types
UPDATE public.categories SET type = 'any'
  WHERE user_id IS NULL AND name IN ('Savings & Investments', 'Other');

-- 3. Seed 6 income system categories
INSERT INTO public.categories (name, color, type) VALUES
  ('Salary',        '#10B981', 'income'),
  ('Freelance',     '#06B6D4', 'income'),
  ('Investments',   '#3B82F6', 'income'),
  ('Benefits',      '#8B5CF6', 'income'),
  ('Rental Income', '#F97316', 'income'),
  ('Other Income',  '#6B7280', 'income');
```

- [ ] **Step 2: Write `005_category_type_down.sql`**

```sql
-- Down migration for 005_category_type
-- Removes the 6 new income system categories, then drops the type column.

DELETE FROM public.categories
  WHERE user_id IS NULL
    AND name IN ('Salary', 'Freelance', 'Investments', 'Benefits', 'Rental Income', 'Other Income');

ALTER TABLE public.categories DROP COLUMN type;
```

- [ ] **Step 3: Apply migration via Supabase MCP**

Use the Supabase MCP server (project `agkvjwysvwvsmequbpub`) to apply:
```
mcp__supabase__apply_migration with name="005_category_type" and the SQL above
```

- [ ] **Step 4: Verify in Supabase**

Run:
```sql
SELECT name, type FROM categories WHERE user_id IS NULL ORDER BY type, name;
```
Expected: 10 rows with `type = 'expense'`, 2 with `type = 'any'`, 6 with `type = 'income'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_category_type.sql supabase/migrations/005_category_type_down.sql
git commit -m "feat(db): add type column to categories (expense|income|any), seed income defaults"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `apps/web/types/database.ts`
- Modify: `apps/mobile/types/database.ts`

- [ ] **Step 1: Update `apps/web/types/database.ts`**

Add `CategoryType` export and `type` field to `CategoryRow` and `CategoryInsert`.

Replace the top of the file (lines 13–14, the source/type exports) and the `CategoryRow` and `CategoryInsert` blocks:

```typescript
export type TransactionSource = 'manual' | 'bank_sync' | 'ocr'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CategoryType = 'expense' | 'income' | 'any'
```

Update `CategoryRow`:
```typescript
export interface CategoryRow {
  id: string
  user_id: string | null
  name: string
  color: string
  type: CategoryType
  created_at: string
}
```

Update `CategoryInsert`:
```typescript
export interface CategoryInsert {
  id?: string
  user_id?: string | null
  name: string
  color: string
  type: CategoryType
  created_at?: string
}
```

Update the `Enums` block inside `Database`:
```typescript
    Enums: {
      transaction_source: TransactionSource
      transaction_type: TransactionType
      category_type: CategoryType
    }
```

(`CategoryUpdate` uses `Partial<Omit<CategoryRow, ...>>` so it picks up `type` automatically.)

- [ ] **Step 2: Update `apps/mobile/types/database.ts`**

Add `CategoryType` and update `CategoryRow`:

```typescript
export type TransactionSource = 'manual' | 'bank_sync' | 'ocr'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CategoryType = 'expense' | 'income' | 'any'

// ... (TransactionRow unchanged) ...

export interface CategoryRow {
  id: string
  user_id: string | null
  name: string
  color: string
  type: CategoryType
  created_at: string
}

export type Transaction = TransactionRow
export type Category = CategoryRow
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/types/database.ts apps/mobile/types/database.ts
git commit -m "feat(types): add CategoryType and type field to CategoryRow in web and mobile"
```

---

## Task 3: Category Zod Schema + Unit Tests

**Files:**
- Create: `apps/web/lib/schemas/category.ts`
- Create: `apps/web/__tests__/api/category-schema.test.ts`

- [ ] **Step 1: Write `apps/web/lib/schemas/category.ts`**

```typescript
import { z } from 'zod'

export const CategoryTypeEnum = z.enum(['expense', 'income', 'any'])
export type CategoryTypeInput = z.infer<typeof CategoryTypeEnum>

export const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  type: CategoryTypeEnum,
})

export type CategoryInput = z.infer<typeof CategorySchema>
```

- [ ] **Step 2: Write the failing tests in `apps/web/__tests__/api/category-schema.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { CategorySchema } from '@/lib/schemas/category'

const valid = { name: 'Salary', color: '#10B981', type: 'income' as const }

describe('CategorySchema', () => {
  it('accepts a valid expense category', () => {
    expect(CategorySchema.safeParse({ ...valid, type: 'expense' }).success).toBe(true)
  })

  it('accepts a valid income category', () => {
    expect(CategorySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a valid any category', () => {
    expect(CategorySchema.safeParse({ ...valid, type: 'any' }).success).toBe(true)
  })

  it('rejects an invalid type', () => {
    const result = CategorySchema.safeParse({ ...valid, type: 'transfer' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.type).toBeTruthy()
    }
  })

  it('rejects missing type', () => {
    const { type: _, ...noType } = valid
    const result = CategorySchema.safeParse(noType)
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CategorySchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeTruthy()
    }
  })

  it('rejects malformed color', () => {
    const result = CategorySchema.safeParse({ ...valid, color: 'red' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.color).toBeTruthy()
    }
  })
})
```

- [ ] **Step 3: Run tests to verify they fail (schema file exists but wrong)**

```bash
pnpm --filter web exec vitest run __tests__/api/category-schema.test.ts
```
Expected: PASS (schema already written correctly in step 1) — if any fail, fix the schema.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/schemas/category.ts apps/web/__tests__/api/category-schema.test.ts
git commit -m "feat(schema): add CategorySchema with type field, unit tests"
```

---

## Task 4: Web Server Actions

**Files:**
- Modify: `apps/web/lib/actions/categories.ts`

- [ ] **Step 1: Replace inline schema with import and add `type` to field errors**

At the top of `apps/web/lib/actions/categories.ts`, replace the existing inline `CategorySchema` and `z` import with:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CategorySchema } from '@/lib/schemas/category'
```

Remove the `import { z } from 'zod'` line and the inline `CategorySchema` definition (lines 3–14 in the current file).

Update `CategoryActionState` to include `type` in `fieldErrors`:

```typescript
export type CategoryActionState = {
  fieldErrors?: { name?: string[]; color?: string[]; type?: string[] }
  error?: string
  success?: boolean
  requiresReassignment?: boolean
  count?: number
} | null
```

- [ ] **Step 2: Update `createCategory` to read and insert `type`**

In `createCategory`, update the `raw` object and destructuring:

```typescript
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // ...auth check...

  const { name, color, type } = parsed.data

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name,
    color,
    type,
  })
```

- [ ] **Step 3: Update `updateCategory` to read and update `type`**

In `updateCategory`, update `raw` and the `.update()` call:

```typescript
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // ...auth check...

  const { name, color, type } = parsed.data

  const { data: updated, error } = await supabase
    .from('categories')
    .update({ name, color, type })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/actions/categories.ts
git commit -m "feat(actions): accept and persist category type in create/update"
```

---

## Task 5: Web CategoryForm — Type Selector

**Files:**
- Modify: `apps/web/components/categories/CategoryForm.tsx`

- [ ] **Step 1: Add type radio group to the form**

In `CategoryForm.tsx`, after the `defaultColor` constant add:

```typescript
  const defaultType = category?.type ?? 'expense'
```

Add the type selector between the Name field's closing `</div>` and the Color picker's opening `<div>`:

```tsx
      {/* Type selector */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Type</p>
        <div role="radiogroup" aria-label="Category type" className="flex gap-4">
          {(['expense', 'income', 'any'] as const).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="type"
                value={t}
                defaultChecked={t === defaultType}
                required
                className="accent-zinc-900 dark:accent-zinc-100"
              />
              <span className="text-sm capitalize text-zinc-700 dark:text-zinc-300">
                {t === 'any' ? 'Both' : t}
              </span>
            </label>
          ))}
        </div>
        {state?.fieldErrors?.type?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/categories/CategoryForm.tsx
git commit -m "feat(ui): add type selector (expense/income/both) to CategoryForm"
```

---

## Task 6: Web CategoryList — Type Badges

**Files:**
- Modify: `apps/web/components/categories/CategoryList.tsx`

- [ ] **Step 1: Add a type badge to system category rows**

In the `systemCategories.map()` render (the `<li>` inside the `<ul>`), add a type badge after the name `<span>`:

```tsx
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <ColorDot color={cat.color} />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{cat.name}</span>
              <div className="ml-auto flex items-center gap-2">
                <TypeBadge type={cat.type} />
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  System
                </span>
              </div>
            </li>
```

- [ ] **Step 2: Add a type badge to user category rows**

In `UserCategoryRow`, inside the main row `<div>`, add `<TypeBadge type={category.type} />` before the Edit button:

```tsx
        <div className="ml-auto flex items-center gap-2">
          <TypeBadge type={category.type} />
          {/* Edit button */}
          <button ...>Edit</button>
          {/* Delete form */}
          ...
        </div>
```

- [ ] **Step 3: Add the `TypeBadge` component at the bottom of the file (before `ColorDot`)**

```tsx
// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

interface TypeBadgeProps {
  type: string
}

function TypeBadge({ type }: TypeBadgeProps) {
  const label = type === 'any' ? 'Both' : type
  const colorClass =
    type === 'income'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : type === 'expense'
        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${colorClass}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/categories/CategoryList.tsx
git commit -m "feat(ui): show type badge (expense/income/both) on each category row"
```

---

## Task 7: Web TransactionForm — Filter Categories by Type

**Files:**
- Modify: `apps/web/components/transactions/TransactionForm.tsx`

- [ ] **Step 1: Filter categories based on selected transaction type**

In `TransactionForm.tsx`, after the `isTransfer` constant add:

```typescript
  const filteredCategories = isTransfer
    ? []
    : categories.filter((c) => c.type === type || c.type === 'any')
```

- [ ] **Step 2: Replace `categories.map(...)` in the category `<select>` with `filteredCategories.map(...)`**

Change:
```tsx
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
```

To:
```tsx
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run existing unit tests**

```bash
pnpm --filter web test:unit
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/transactions/TransactionForm.tsx
git commit -m "feat(ui): filter category picker by transaction type (expense/income/any)"
```

---

## Task 8: Mobile — Types, Hook, TransactionForm

**Files:**
- Modify: `apps/mobile/hooks/useCategories.ts`
- Modify: `apps/mobile/components/transactions/TransactionForm.tsx`

- [ ] **Step 1: Update `apps/mobile/hooks/useCategories.ts` to fetch `type` and use the shared type**

Replace the entire file:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/database'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, color, type, user_id, created_at')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('useCategories fetch error:', error)
        if (data) setCategories(data as Category[])
        setLoading(false)
      })
  }, [])

  return { categories, loading }
}
```

- [ ] **Step 2: Filter categories in `apps/mobile/components/transactions/TransactionForm.tsx`**

After the existing `const selectedCategory = ...` line, add:

```typescript
  const filteredCategories = isTransfer
    ? []
    : categories.filter((c) => c.type === type || c.type === 'any')
```

Then in the `FlatList` and the `selectedCategory` lookup, replace all references to `categories` with `filteredCategories`:

```tsx
              const selectedCategory = filteredCategories.find((c) => c.id === categoryId)
```

And in `FlatList`:
```tsx
              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                ...
              />
```

Also reset `categoryId` to `null` when the type changes (since the previously selected category may no longer be valid):

```typescript
  function handleTypeChange(newType: TransactionType) {
    setType(newType)
    setCategoryId(null)
  }
```

And in the type segmented control `onPress`:
```tsx
                onPress={() => handleTypeChange(opt.value)}
```

- [ ] **Step 3: Verify mobile TypeScript**

```bash
pnpm --filter mobile exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useCategories.ts apps/mobile/components/transactions/TransactionForm.tsx
git commit -m "feat(mobile): filter category picker by transaction type, fetch type field"
```

---

## Task 9: Run All Tests

- [ ] **Step 1: Run all web unit tests**

```bash
pnpm --filter web test:unit
```
Expected: all tests pass (category-schema + transaction-schema + receipts-parse).

- [ ] **Step 2: Final TypeScript check across both apps**

```bash
pnpm --filter web exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit
```
Expected: no errors in either app.

- [ ] **Step 3: Commit (if any last fixes needed)**

```bash
git add -p
git commit -m "fix: address any final TypeScript errors from income-categories feature"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `type` column on `categories` table — Task 1
- [x] Existing 12 expense categories backfilled to `expense` (2 to `any`) — Task 1
- [x] 6 income system categories seeded — Task 1
- [x] TypeScript types updated in both apps — Task 2
- [x] Zod schema validation + unit tests — Task 3
- [x] Server actions accept `type` field — Task 4
- [x] Web CategoryForm has type selector — Task 5
- [x] Web CategoryList shows type badges — Task 6
- [x] Web TransactionForm filters by type — Task 7
- [x] Mobile hook fetches `type` — Task 8
- [x] Mobile TransactionForm filters by type — Task 8
- [x] Category reset on type switch (mobile) — Task 8
- [x] Down migration — Task 1

**No placeholders found.**

**Type consistency:** `CategoryType = 'expense' | 'income' | 'any'` used in `database.ts` (both apps), `CategorySchema` (Zod enum), and the filter predicate `c.type === type || c.type === 'any'` — consistent throughout.

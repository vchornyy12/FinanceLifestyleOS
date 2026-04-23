# Category CRUD + Subcategories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace global read-only system categories with a fully editable per-user category tree (6 parents + 24 subcategories seeded at signup), with a rewritten categories UI and an optgroup transaction picker.

**Architecture:** A DB migration adds `parent_id` to `categories`, creates a `seed_user_categories(uuid)` PL/pgSQL function called by the signup trigger, seeds existing users, remaps transaction references, and removes the old system rows. The web UI becomes an expandable tree; the transaction form category picker uses `<optgroup>`. No mobile changes.

**Tech Stack:** Supabase PostgreSQL, PL/pgSQL, TypeScript, Zod, Next.js 16 Server Actions, React 19

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/006_category_tree.sql` |
| Create | `supabase/migrations/006_category_tree_down.sql` |
| Modify | `apps/web/types/database.ts` |
| Modify | `apps/web/lib/schemas/category.ts` |
| Modify | `apps/web/__tests__/api/category-schema.test.ts` |
| Create | `apps/web/lib/supabase/queries/categories.ts` |
| Modify | `apps/web/lib/actions/categories.ts` |
| Modify | `apps/web/components/categories/CategoryForm.tsx` |
| Modify | `apps/web/components/categories/CategoryList.tsx` |
| Modify | `apps/web/app/dashboard/settings/categories/page.tsx` |
| Modify | `apps/web/components/transactions/TransactionForm.tsx` |

---

## Task 1: DB Migration — parent_id + per-user seeding

**Files:**
- Create: `supabase/migrations/006_category_tree.sql`
- Create: `supabase/migrations/006_category_tree_down.sql`

- [ ] **Step 1: Write `supabase/migrations/006_category_tree.sql`**

```sql
-- Migration: 006_category_tree
-- Description: Add parent_id to categories. Replace global system categories with
-- per-user seeded trees (6 parents, 24 subcategories). Update signup trigger.
-- Seed existing users. Remap + nullify stale transaction references. Update RLS.

-- ============================================================
-- 1. Add parent_id column
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);

-- ============================================================
-- 2. Seed function: creates 30 categories for one user
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_user_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  income_id    UUID;
  food_id      UUID;
  housing_id   UUID;
  transport_id UUID;
  finance_id   UUID;
  personal_id  UUID;
BEGIN
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Income', '#10B981', 'income') RETURNING id INTO income_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Food & Dining', '#F97316', 'expense') RETURNING id INTO food_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Housing & Bills', '#3B82F6', 'expense') RETURNING id INTO housing_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Transport', '#F59E0B', 'expense') RETURNING id INTO transport_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Finance', '#EF4444', 'expense') RETURNING id INTO finance_id;
  INSERT INTO public.categories (user_id, name, color, type)
    VALUES (p_user_id, 'Personal', '#8B5CF6', 'expense') RETURNING id INTO personal_id;

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Salary',       '#10B981', 'income', income_id),
    (p_user_id, 'Bonus',        '#10B981', 'income', income_id),
    (p_user_id, 'Freelance',    '#10B981', 'income', income_id),
    (p_user_id, 'Other Income', '#10B981', 'income', income_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Supermarket', '#F97316', 'expense', food_id),
    (p_user_id, 'Restaurant',  '#F97316', 'expense', food_id),
    (p_user_id, 'Café',        '#F97316', 'expense', food_id),
    (p_user_id, 'Takeaway',    '#F97316', 'expense', food_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Rent/Mortgage',    '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Utilities',        '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Internet & Phone', '#3B82F6', 'expense', housing_id),
    (p_user_id, 'Home Maintenance', '#3B82F6', 'expense', housing_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Fuel',             '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Car Insurance',    '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Car Maintenance',  '#F59E0B', 'expense', transport_id),
    (p_user_id, 'Public Transport', '#F59E0B', 'expense', transport_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Credit Payment',   '#EF4444', 'expense', finance_id),
    (p_user_id, 'Loan Repayment',   '#EF4444', 'expense', finance_id),
    (p_user_id, 'Savings Transfer', '#EF4444', 'expense', finance_id);

  INSERT INTO public.categories (user_id, name, color, type, parent_id) VALUES
    (p_user_id, 'Health & Medical',    '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Shopping & Clothing', '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Entertainment',       '#8B5CF6', 'expense', personal_id),
    (p_user_id, 'Education',           '#8B5CF6', 'expense', personal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_user_categories(UUID) FROM PUBLIC;

-- ============================================================
-- 3. Update handle_new_user trigger to call seed function
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  PERFORM public.seed_user_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Seed categories for existing users who have none
-- ============================================================
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT id FROM auth.users
    WHERE id NOT IN (
      SELECT DISTINCT user_id FROM public.categories WHERE user_id IS NOT NULL
    )
  LOOP
    PERFORM public.seed_user_categories(u.id);
  END LOOP;
END;
$$;

-- ============================================================
-- 5. Remap transaction references from old system categories
--    to matching new user-owned categories (best-effort by name).
--    Remaining mismatches are set to NULL.
-- ============================================================
UPDATE public.transactions t
SET category_id = (
  SELECT uc.id
  FROM public.categories uc
  WHERE uc.user_id = t.user_id
    AND LOWER(uc.name) = (
      SELECT LOWER(sc.name)
      FROM public.categories sc
      WHERE sc.id = t.category_id
    )
  LIMIT 1
)
WHERE t.category_id IN (SELECT id FROM public.categories WHERE user_id IS NULL);

UPDATE public.transactions
SET category_id = NULL
WHERE category_id IN (SELECT id FROM public.categories WHERE user_id IS NULL);

-- ============================================================
-- 6. Delete all system categories (user_id IS NULL)
-- ============================================================
DELETE FROM public.categories WHERE user_id IS NULL;

-- ============================================================
-- 7. Update RLS: drop old policy that exposed system defaults,
--    add simple own-only select policy
-- ============================================================
DROP POLICY IF EXISTS "categories_select_own_and_defaults" ON public.categories;

CREATE POLICY "categories_select_own"
  ON public.categories
  FOR SELECT
  USING (user_id = auth.uid());
```

- [ ] **Step 2: Write `supabase/migrations/006_category_tree_down.sql`**

```sql
-- Down migration for 006_category_tree
-- Drops parent_id column and restores old RLS select policy.
-- Does NOT restore system categories or remove seeded user categories.

DROP POLICY IF EXISTS "categories_select_own" ON public.categories;

CREATE POLICY "categories_select_own_and_defaults"
  ON public.categories
  FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP INDEX IF EXISTS public.idx_categories_parent_id;

ALTER TABLE public.categories DROP COLUMN parent_id;

DROP FUNCTION IF EXISTS public.seed_user_categories(UUID);
```

- [ ] **Step 3: Apply the migration via Supabase MCP**

Use `mcp__supabase__apply_migration`:
- `project_id`: `agkvjwysvwvsmequbpub`
- `name`: `006_category_tree`
- `query`: the full SQL from `006_category_tree.sql`

- [ ] **Step 4: Verify via Supabase MCP**

Run SQL via `mcp__supabase__execute_sql`:
```sql
SELECT
  (SELECT COUNT(*) FROM categories WHERE user_id IS NULL) AS system_remaining,
  (SELECT COUNT(*) FROM categories WHERE parent_id IS NULL AND user_id IS NOT NULL) AS user_parents,
  (SELECT COUNT(*) FROM categories WHERE parent_id IS NOT NULL) AS user_subcategories;
```
Expected: `system_remaining = 0`, `user_parents = 6` (per existing user), `user_subcategories = 24` (per existing user).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/006_category_tree.sql supabase/migrations/006_category_tree_down.sql
git commit -m "feat(db): add parent_id to categories, per-user seed tree, retire system defaults"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `apps/web/types/database.ts`

- [ ] **Step 1: Add `parent_id` to `CategoryRow` and `CategoryInsert`, update file header**

Replace the file header comment (lines 1–12) to reference migration 006:

```typescript
/**
 * Supabase database type definitions.
 *
 * Mirrors the schema defined in:
 *   supabase/migrations/001_initial_schema.sql
 *   supabase/migrations/002_rls_policies.sql
 *   supabase/migrations/003_receipt_storage.sql
 *   supabase/migrations/004_transaction_type.sql
 *   supabase/migrations/005_category_type.sql
 *   supabase/migrations/006_category_tree.sql
 */
```

Replace `CategoryRow`:
```typescript
export interface CategoryRow {
  id: string
  user_id: string | null
  name: string
  color: string
  type: CategoryType
  parent_id: string | null
  created_at: string
}
```

Replace `CategoryInsert`:
```typescript
export interface CategoryInsert {
  id?: string
  user_id?: string | null
  name: string
  color: string
  type: CategoryType
  parent_id?: string | null
  created_at?: string
}
```

(`CategoryUpdate` is `Partial<Omit<CategoryRow, 'id' | 'user_id' | 'created_at'>>` — it will automatically include `parent_id`.)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/types/database.ts
git commit -m "feat(types): add parent_id to CategoryRow and CategoryInsert"
```

---

## Task 3: Zod Schema Update + Unit Tests

**Files:**
- Modify: `apps/web/lib/schemas/category.ts`
- Modify: `apps/web/__tests__/api/category-schema.test.ts`

- [ ] **Step 1: Update `apps/web/lib/schemas/category.ts`**

Replace the entire file:

```typescript
import { z } from 'zod'

export const CategoryTypeEnum = z.enum(['expense', 'income', 'any'])
export type CategoryTypeInput = z.infer<typeof CategoryTypeEnum>

export const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  type: CategoryTypeEnum,
  parent_id: z.string().uuid().nullable().optional(),
})

export type CategoryInput = z.infer<typeof CategorySchema>
```

- [ ] **Step 2: Update `apps/web/__tests__/api/category-schema.test.ts`**

Replace the entire file:

```typescript
import { describe, it, expect } from 'vitest'
import { CategorySchema } from '@/lib/schemas/category'

const VALID_UUID = '00000000-0000-4000-8000-000000000000'
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

  it('accepts a category with a valid parent_id UUID', () => {
    expect(
      CategorySchema.safeParse({ ...valid, parent_id: VALID_UUID }).success
    ).toBe(true)
  })

  it('accepts a category with parent_id: null', () => {
    expect(
      CategorySchema.safeParse({ ...valid, parent_id: null }).success
    ).toBe(true)
  })

  it('rejects a category with a non-UUID parent_id', () => {
    const result = CategorySchema.safeParse({ ...valid, parent_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.parent_id).toBeTruthy()
    }
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
    expect(CategorySchema.safeParse(noType).success).toBe(false)
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

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web exec vitest run __tests__/api/category-schema.test.ts
```
Expected: 10/10 pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/schemas/category.ts apps/web/__tests__/api/category-schema.test.ts
git commit -m "feat(schema): add parent_id to CategorySchema, expand unit tests to 10"
```

---

## Task 4: Category Query Helper

**Files:**
- Create: `apps/web/lib/supabase/queries/categories.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/types/database'

export type CategoryWithChildren = Category & { children: Category[] }

/**
 * Fetch all categories for the current user and return them as a tree.
 * Parents (parent_id = null) are sorted alphabetically; children sorted
 * alphabetically within their parent.
 *
 * RLS ensures only the current user's rows are returned.
 */
export async function getUserCategoryTree(): Promise<CategoryWithChildren[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`)
  }

  const rows = (data ?? []) as Category[]
  const childrenMap = new Map<string, Category[]>()

  for (const row of rows) {
    if (row.parent_id) {
      const existing = childrenMap.get(row.parent_id) ?? []
      childrenMap.set(row.parent_id, [...existing, row])
    }
  }

  return rows
    .filter((r) => r.parent_id === null)
    .map((parent) => ({
      ...parent,
      children: childrenMap.get(parent.id) ?? [],
    }))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/supabase/queries/categories.ts
git commit -m "feat(query): add getUserCategoryTree helper"
```

---

## Task 5: Server Actions Update

**Files:**
- Modify: `apps/web/lib/actions/categories.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CategorySchema } from '@/lib/schemas/category'

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type CategoryActionState = {
  fieldErrors?: { name?: string[]; color?: string[]; type?: string[]; parent_id?: string[] }
  error?: string
  success?: boolean
  requiresReassignment?: boolean
  count?: number
  subcategoryCount?: number
} | null

// ---------------------------------------------------------------------------
// UUID regex
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parentIdRaw = formData.get('parent_id') as string | null
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
    parent_id: parentIdRaw || null,
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  const { name, color, type, parent_id } = parsed.data

  // Nesting guard: parent must itself be a top-level category
  if (parent_id) {
    const { data: parent } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', parent_id)
      .eq('user_id', user.id)
      .single()
    if (!parent) return { error: 'Parent category not found.' }
    if (parent.parent_id !== null) return { error: 'Cannot nest deeper than one level.' }
  }

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name,
    color,
    type,
    parent_id: parent_id ?? null,
  })

  if (error) return { error: `Failed to create category: ${error.message}` }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

export async function updateCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_REGEX.test(id)) return { error: 'Invalid category ID.' }

  const parentIdRaw = formData.get('parent_id') as string | null
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
    parent_id: parentIdRaw || null,
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  const { name, color, type, parent_id } = parsed.data

  // Nesting guard
  if (parent_id) {
    if (parent_id === id) return { error: 'A category cannot be its own parent.' }
    const { data: parent } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', parent_id)
      .eq('user_id', user.id)
      .single()
    if (!parent) return { error: 'Parent category not found.' }
    if (parent.parent_id !== null) return { error: 'Cannot nest deeper than one level.' }
  }

  const { data: updated, error } = await supabase
    .from('categories')
    .update({ name, color, type, parent_id: parent_id ?? null })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return { error: 'Failed to update category.' }
  if (!updated || updated.length === 0) return { error: 'Category not found or permission denied.' }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

export async function deleteCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_REGEX.test(id)) return { error: 'Invalid category ID.' }

  const reassignToId = formData.get('reassignToId') as string | null
  if (reassignToId && !UUID_REGEX.test(reassignToId)) return { error: 'Invalid reassign target ID.' }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  // Get subcategory IDs (children of this category)
  const { data: subs } = await supabase
    .from('categories')
    .select('id')
    .eq('parent_id', id)
    .eq('user_id', user.id)
  const subIds = (subs ?? []).map((s) => s.id)

  // Count transactions on this category
  const { count: directCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('user_id', user.id)

  // Count transactions on its subcategories
  let subTxCount = 0
  if (subIds.length > 0) {
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('category_id', subIds)
      .eq('user_id', user.id)
    subTxCount = count ?? 0
  }

  const totalTxCount = (directCount ?? 0) + subTxCount

  if (totalTxCount > 0 && !reassignToId) {
    return {
      requiresReassignment: true,
      count: totalTxCount,
      subcategoryCount: subIds.length,
    }
  }

  if (totalTxCount > 0 && reassignToId) {
    // Verify target category belongs to this user
    const { count: targetCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('id', reassignToId)
      .eq('user_id', user.id)
    if (!targetCount) return { error: 'Reassignment target category not found.' }

    // Reassign direct transactions
    const { error: reassignDirect } = await supabase
      .from('transactions')
      .update({ category_id: reassignToId })
      .eq('category_id', id)
      .eq('user_id', user.id)
    if (reassignDirect) return { error: 'Failed to reassign transactions.' }

    // Reassign subcategory transactions
    if (subIds.length > 0) {
      const { error: reassignSubs } = await supabase
        .from('transactions')
        .update({ category_id: reassignToId })
        .in('category_id', subIds)
        .eq('user_id', user.id)
      if (reassignSubs) return { error: 'Failed to reassign subcategory transactions.' }
    }
  }

  // Delete the category — CASCADE removes subcategories at DB level
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) return { error: `Failed to delete category: ${deleteError.message}` }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}
```

- [ ] **Step 2: Run all unit tests**

```bash
pnpm --filter web test:unit
```
Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/actions/categories.ts
git commit -m "feat(actions): add parent_id support and subcategory-aware delete"
```

---

## Task 6: CategoryForm Update

**Files:**
- Modify: `apps/web/components/categories/CategoryForm.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useActionState } from 'react'
import type { Category } from '@/types/database'
import { createCategory, updateCategory, type CategoryActionState } from '@/lib/actions/categories'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B',
  '#10B981', '#6B7280',
] as const

interface CategoryFormProps {
  /** Editing an existing category. */
  category?: Category
  /** When set, this form creates a subcategory under this parent. */
  parentCategory?: Category
  onCancel: () => void
}

export default function CategoryForm({ category, parentCategory, onCancel }: CategoryFormProps) {
  const isEdit = category !== undefined
  const isSub = parentCategory !== undefined && !isEdit

  const action = isEdit ? updateCategory : createCategory
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(action, null)

  // In subcategory-create mode, inherit parent's color; otherwise use blue default
  const defaultColor = category?.color ?? parentCategory?.color ?? PRESET_COLORS[5]
  const defaultType = category?.type ?? parentCategory?.type ?? 'expense'

  return (
    <form
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {isEdit && <input type="hidden" name="id" value={category.id} />}
      {/* parent_id: present when creating a subcategory, or preserving existing parent */}
      <input
        type="hidden"
        name="parent_id"
        value={
          isEdit
            ? (category.parent_id ?? '')
            : isSub
              ? parentCategory.id
              : ''
        }
      />

      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {isEdit
          ? 'Edit category'
          : isSub
            ? `New subcategory under "${parentCategory.name}"`
            : 'New category'}
      </h3>

      {state?.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* Name */}
      <div className="mb-4">
        <label
          htmlFor={`category-name-${category?.id ?? 'new'}`}
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Name
        </label>
        <input
          id={`category-name-${category?.id ?? 'new'}`}
          name="name"
          type="text"
          required
          defaultValue={category?.name ?? ''}
          maxLength={50}
          placeholder={isSub ? 'e.g. Supermarket' : 'e.g. Food & Dining'}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.name?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>
        ))}
      </div>

      {/* Type selector — hidden for subcategories (type fixed by parent) */}
      {!isSub && (
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
            <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>
          ))}
        </div>
      )}

      {/* Hidden type input for subcategories (inherited from parent) */}
      {isSub && <input type="hidden" name="type" value={defaultType} />}

      {/* Color picker */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Color</p>
        <ColorPicker defaultColor={defaultColor} />
        {state?.fieldErrors?.color?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// ColorPicker
// ---------------------------------------------------------------------------

function ColorPicker({ defaultColor }: { defaultColor: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category color">
      {PRESET_COLORS.map((color) => (
        <label key={color} className="relative cursor-pointer" aria-label={color}>
          <input
            type="radio"
            name="color"
            value={color}
            defaultChecked={color === defaultColor}
            className="peer sr-only"
            required
          />
          <span
            className="block h-7 w-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-white transition-all peer-checked:ring-zinc-700 dark:ring-offset-zinc-900 dark:peer-checked:ring-zinc-300"
            style={{ backgroundColor: color }}
          />
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/categories/CategoryForm.tsx
git commit -m "feat(ui): update CategoryForm to support parent/subcategory modes"
```

---

## Task 7: CategoryList Rewrite

**Files:**
- Modify: `apps/web/components/categories/CategoryList.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useState, useEffect, useActionState } from 'react'
import type { Category } from '@/types/database'
import type { CategoryWithChildren } from '@/lib/supabase/queries/categories'
import { deleteCategory, type CategoryActionState } from '@/lib/actions/categories'
import CategoryForm from './CategoryForm'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryListProps {
  tree: CategoryWithChildren[]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CategoryList({ tree }: CategoryListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showCreateFor, setShowCreateFor] = useState<'top-level' | string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Reset UI when tree changes (server revalidation after create/update/delete)
  useEffect(() => {
    setEditingId(null)
    setShowCreateFor(null)
  }, [tree])

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // Flat list of all categories (for reassignment dropdowns)
  const allCategories: Category[] = tree.flatMap((p) => [p, ...p.children])

  return (
    <div className="flex flex-col gap-2">
      {tree.map((parent) => (
        <div key={parent.id} className="flex flex-col gap-1">
          {/* Parent row or inline edit form */}
          {editingId === parent.id ? (
            <CategoryForm category={parent} onCancel={() => setEditingId(null)} />
          ) : (
            <ParentRow
              category={parent}
              expanded={expandedIds.has(parent.id)}
              onToggle={() => toggle(parent.id)}
              onEdit={() => setEditingId(parent.id)}
              onAddSub={() => {
                setExpandedIds((prev) => new Set([...prev, parent.id]))
                setShowCreateFor(parent.id)
              }}
              allCategories={allCategories}
            />
          )}

          {/* Subcategories — shown when expanded */}
          {expandedIds.has(parent.id) && (
            <div className="ml-7 flex flex-col gap-1">
              {parent.children.map((child) =>
                editingId === child.id ? (
                  <CategoryForm
                    key={child.id}
                    category={child}
                    parentCategory={parent}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <LeafRow
                    key={child.id}
                    category={child}
                    onEdit={() => setEditingId(child.id)}
                    allCategories={allCategories}
                  />
                ),
              )}

              {/* Inline create-subcategory form */}
              {showCreateFor === parent.id && (
                <CategoryForm
                  parentCategory={parent}
                  onCancel={() => setShowCreateFor(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Create top-level category */}
      <div className="mt-4">
        {showCreateFor === 'top-level' ? (
          <CategoryForm onCancel={() => setShowCreateFor(null)} />
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreateFor('top-level')}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              + Add category
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParentRow
// ---------------------------------------------------------------------------

interface ParentRowProps {
  category: CategoryWithChildren
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onAddSub: () => void
  allCategories: Category[]
}

function ParentRow({ category, expanded, onToggle, onEdit, onAddSub, allCategories }: ParentRowProps) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    deleteCategory,
    null,
  )
  const reassignOptions = allCategories.filter((c) => c.id !== category.id)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-zinc-400 transition-transform hover:text-zinc-700 dark:hover:text-zinc-300"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </button>
        <ColorDot color={category.color} />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{category.name}</span>
        <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
          {category.children.length > 0 ? `${category.children.length}` : ''}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <TypeBadge type={category.type} />
          <button
            type="button"
            onClick={onAddSub}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            + Sub
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Edit
          </button>
          <form action={formAction}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </form>
        </div>
      </div>

      {state?.error && (
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      {state?.requiresReassignment && (
        <ReassignPrompt
          categoryId={category.id}
          count={state.count ?? 0}
          subcategoryCount={state.subcategoryCount ?? 0}
          options={reassignOptions}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LeafRow
// ---------------------------------------------------------------------------

interface LeafRowProps {
  category: Category
  onEdit: () => void
  allCategories: Category[]
}

function LeafRow({ category, onEdit, allCategories }: LeafRowProps) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    deleteCategory,
    null,
  )
  const reassignOptions = allCategories.filter((c) => c.id !== category.id)

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <ColorDot color={category.color} />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{category.name}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Edit
          </button>
          <form action={formAction}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </form>
        </div>
      </div>

      {state?.error && (
        <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      {state?.requiresReassignment && (
        <ReassignPrompt
          categoryId={category.id}
          count={state.count ?? 0}
          subcategoryCount={0}
          options={reassignOptions}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReassignPrompt
// ---------------------------------------------------------------------------

interface ReassignPromptProps {
  categoryId: string
  count: number
  subcategoryCount: number
  options: Category[]
}

function ReassignPrompt({ categoryId, count, subcategoryCount, options }: ReassignPromptProps) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    deleteCategory,
    null,
  )

  const txLabel = `${count} transaction${count !== 1 ? 's' : ''}`
  const subLabel =
    subcategoryCount > 0
      ? ` (and ${subcategoryCount} subcategor${subcategoryCount !== 1 ? 'ies' : 'y'})`
      : ''

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
      <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">
        This category has {txLabel}{subLabel}. Reassign them before deleting.
      </p>

      {state?.error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={categoryId} />
        <label htmlFor={`reassign-${categoryId}`} className="sr-only">
          Reassign transactions to
        </label>
        <select
          id={`reassign-${categoryId}`}
          name="reassignToId"
          required
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">Select a category…</option>
          {options.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Deleting…' : 'Reassign & delete'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TypeBadge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: Category['type'] }) {
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

// ---------------------------------------------------------------------------
// ColorDot
// ---------------------------------------------------------------------------

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="block h-3 w-3 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/categories/CategoryList.tsx
git commit -m "feat(ui): rewrite CategoryList as expandable tree with subcategory support"
```

---

## Task 8: Categories Page Update

**Files:**
- Modify: `apps/web/app/dashboard/settings/categories/page.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCategoryTree } from '@/lib/supabase/queries/categories'
import CategoryList from '@/components/categories/CategoryList'

export const metadata = {
  title: 'Categories | Finance Lifestyle OS',
}

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tree = await getUserCategoryTree()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Categories</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your categories. Click a category to expand its subcategories.
        </p>
      </div>

      <CategoryList tree={tree} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/settings/categories/page.tsx
git commit -m "feat(ui): update categories page to use tree query and new CategoryList"
```

---

## Task 9: TransactionForm — optgroup Category Picker

**Files:**
- Modify: `apps/web/components/transactions/TransactionForm.tsx`

- [ ] **Step 1: Read the current file before editing**

The relevant section to replace is the `filteredCategories` computation and the `<select>` inside the `{!isTransfer && (...)}` block. The file is at `apps/web/components/transactions/TransactionForm.tsx`.

- [ ] **Step 2: Replace the `filteredCategories` computation**

Find:
```typescript
  const filteredCategories = isTransfer
    ? []
    : categories.filter((c) => c.type === type || c.type === 'any')
```

Replace with:
```typescript
  const filteredCategories = isTransfer
    ? []
    : categories.filter((c) => c.type === type || c.type === 'any')

  // Group into parent → children for optgroup rendering
  const categoryTree = (() => {
    const parents = filteredCategories.filter((c) => c.parent_id === null)
    const childrenMap = new Map<string, typeof categories>()
    for (const c of filteredCategories) {
      if (c.parent_id) {
        childrenMap.set(c.parent_id, [...(childrenMap.get(c.parent_id) ?? []), c])
      }
    }
    return parents.map((p) => ({ parent: p, children: childrenMap.get(p.id) ?? [] }))
  })()
```

- [ ] **Step 3: Replace the category `<select>` content**

Find the `<select>` element (which currently has `key={type}` and `filteredCategories.map(...)`). Replace its content:

```tsx
          <select
            key={type}
            id="category_id"
            name="category_id"
            defaultValue={defaultCategoryId}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          >
            <option value="">No category</option>
            {categoryTree.map(({ parent, children }) =>
              children.length > 0 ? (
                <optgroup key={parent.id} label={parent.name}>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ),
            )}
          </select>
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test:unit
```
Expected: no errors, all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/transactions/TransactionForm.tsx
git commit -m "feat(ui): use optgroup category picker grouped by parent in TransactionForm"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run all web unit tests**

```bash
pnpm --filter web test:unit
```
Expected: 3 test files, 10 tests, all pass.

- [ ] **Step 2: TypeScript check**

```bash
pnpm --filter web exec tsc --noEmit && pnpm --filter mobile exec tsc --noEmit
```
Expected: 0 errors in both apps.

- [ ] **Step 3: Manual smoke test in browser**

```bash
pnpm --filter web dev
```

1. Navigate to `http://localhost:3000/dashboard/settings/categories`
2. Verify 6 parent rows appear
3. Click a parent — subcategories expand
4. Click Edit on a parent — inline form appears with name/color/type
5. Click Edit on a subcategory — inline form appears without type selector
6. Click "+ Sub" on a parent — subcategory form appears
7. Click "+ Add category" — top-level form appears
8. Navigate to new/edit transaction — verify optgroup picker shows parent headers and subcategory options

---

## Self-Review Checklist

**Spec coverage:**
- [x] `parent_id` column on `categories` — Task 1
- [x] `seed_user_categories` function — Task 1
- [x] Signup trigger updated — Task 1
- [x] Existing users seeded — Task 1
- [x] System categories removed, transactions remapped — Task 1
- [x] RLS simplified to user-only — Task 1
- [x] TypeScript types updated — Task 2
- [x] Zod schema updated — Task 3
- [x] No deeper than 2 levels enforced — Task 5 (nesting guard in actions)
- [x] All categories editable (Edit/Delete on every row) — Task 7
- [x] Create subcategory under parent — Tasks 6 + 7
- [x] Delete parent cascades + reassignment prompt — Tasks 5 + 7
- [x] Transaction form optgroup picker — Task 9
- [x] Subcategories inherit parent type/color as defaults — Task 6
- [x] Down migration — Task 1

**No placeholders found.**

**Type consistency:** `CategoryWithChildren` defined in `queries/categories.ts` and imported in both `CategoryList.tsx` and `CategoriesPage`. `Category['type']` used in `TypeBadge`. All consistent.

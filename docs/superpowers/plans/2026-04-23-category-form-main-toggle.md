# Category Form — Main Category Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split create/subcategory flows with a single `CategoryForm` driven by a "Main category" checkbox — checked means top-level, unchecked reveals a parent radio list and inherits type/color.

**Architecture:** `CategoryForm` gains `isMain` + `selectedParentId` state controlled by a checkbox and radio list. `CategoryList` derives a `mainCategories: Category[]` array from its existing `tree` prop and passes it down to every `CategoryForm` it renders. No server action or DB changes.

**Tech Stack:** React 19 `useState`, TypeScript, Tailwind v4, Next.js 16 Server Actions

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/web/components/categories/CategoryForm.tsx` |
| Modify | `apps/web/components/categories/CategoryList.tsx` |

---

## Task 1: Rewrite CategoryForm

**Files:**
- Modify: `apps/web/components/categories/CategoryForm.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client'

import { useState, useActionState } from 'react'
import type { Category } from '@/types/database'
import { createCategory, updateCategory, type CategoryActionState } from '@/lib/actions/categories'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B',
  '#10B981', '#6B7280',
] as const

interface CategoryFormProps {
  /** Editing an existing category. Drives default checkbox state + pre-selected parent. */
  category?: Category
  /** Full list of top-level categories for the parent radio list. */
  mainCategories: Category[]
  /** Pre-selects a parent and unchecks "Main category". Used by the "+ Sub" button. */
  defaultParentId?: string
  onCancel: () => void
}

export default function CategoryForm({ category, mainCategories, defaultParentId, onCancel }: CategoryFormProps) {
  const isEdit = category !== undefined

  const initialIsMain = category ? category.parent_id === null : defaultParentId === undefined
  const [isMain, setIsMain] = useState(initialIsMain)
  const [selectedParentId, setSelectedParentId] = useState(
    defaultParentId ?? category?.parent_id ?? ''
  )

  const action = isEdit ? updateCategory : createCategory
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(action, null)

  const selectedParent = mainCategories.find((c) => c.id === selectedParentId)

  const defaultColor = category?.color ?? PRESET_COLORS[5]
  const defaultType = category?.type ?? 'expense'

  let heading: string
  if (isEdit) {
    heading = isMain ? 'Edit category' : 'Edit subcategory'
  } else if (!isMain && selectedParent) {
    heading = `New subcategory under "${selectedParent.name}"`
  } else if (!isMain) {
    heading = 'New subcategory'
  } else {
    heading = 'New category'
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {isEdit && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="parent_id" value={isMain ? '' : selectedParentId} />

      {/* Main category toggle */}
      <label className="mb-4 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={isMain}
          onChange={(e) => setIsMain(e.target.checked)}
          className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
        />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Main category</span>
      </label>

      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {heading}
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
          placeholder={isMain ? 'e.g. Food & Dining' : 'e.g. Supermarket'}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.name?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>
        ))}
      </div>

      {/* Type — main categories only */}
      {isMain && (
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

      {/* Color — main categories only */}
      {isMain && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Color</p>
          <ColorPicker defaultColor={defaultColor} />
          {state?.fieldErrors?.color?.map((msg) => (
            <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>
          ))}
        </div>
      )}

      {/* Hidden type + color inherited from selected parent (subcategory mode) */}
      {!isMain && (
        <>
          <input type="hidden" name="type" value={selectedParent?.type ?? ''} />
          <input type="hidden" name="color" value={selectedParent?.color ?? ''} />
        </>
      )}

      {/* Parent radio list — subcategory mode only */}
      {!isMain && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Main category <span className="text-red-500">*</span>
          </p>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            {mainCategories.map((cat, i) => (
              <label
                key={cat.id}
                className={[
                  'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                  selectedParentId === cat.id
                    ? 'bg-zinc-50 dark:bg-zinc-800'
                    : 'bg-white dark:bg-zinc-900',
                  i < mainCategories.length - 1
                    ? 'border-b border-zinc-100 dark:border-zinc-800'
                    : '',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="_parent_radio"
                  value={cat.id}
                  checked={selectedParentId === cat.id}
                  onChange={() => setSelectedParentId(cat.id)}
                  className="accent-zinc-900 dark:accent-zinc-100"
                />
                <span
                  className="block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                <TypeBadge type={cat.type} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || (!isMain && !selectedParentId)}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: errors only from `CategoryList.tsx` (it still passes the old `parentCategory` prop). Fix those in Task 2.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/categories/CategoryForm.tsx
git commit -m "feat(ui): replace parentCategory prop with isMain toggle + parent radio list"
```

---

## Task 2: Update CategoryList to pass mainCategories

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

interface CategoryListProps {
  tree: CategoryWithChildren[]
}

export default function CategoryList({ tree }: CategoryListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [showCreateFor, setShowCreateFor] = useState<'top-level' | string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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

  const allCategories: Category[] = tree.flatMap((p) => [p, ...p.children])
  // Top-level categories only — passed to every CategoryForm for the parent radio list
  const mainCategories: Category[] = tree

  return (
    <div className="flex flex-col gap-2">
      {tree.map((parent) => (
        <div key={parent.id} className="flex flex-col gap-1">
          {editingId === parent.id ? (
            <CategoryForm
              category={parent}
              mainCategories={mainCategories}
              onCancel={() => setEditingId(null)}
            />
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

          {expandedIds.has(parent.id) && (
            <div className="ml-7 flex flex-col gap-1">
              {parent.children.map((child) =>
                editingId === child.id ? (
                  <CategoryForm
                    key={child.id}
                    category={child}
                    mainCategories={mainCategories}
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

              {showCreateFor === parent.id && (
                <CategoryForm
                  mainCategories={mainCategories}
                  defaultParentId={parent.id}
                  onCancel={() => setShowCreateFor(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}

      <div className="mt-4">
        {showCreateFor === 'top-level' ? (
          <CategoryForm
            mainCategories={mainCategories}
            onCancel={() => setShowCreateFor(null)}
          />
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

- [ ] **Step 2: Verify TypeScript compiles with 0 errors**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: no output (0 errors).

- [ ] **Step 3: Run unit tests**

```bash
pnpm --filter web test:unit
```

Expected: 3 test files, 35 tests, all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/categories/CategoryList.tsx
git commit -m "feat(ui): pass mainCategories to CategoryForm, use defaultParentId for sub creation"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] "Main category" checkbox — Task 1
- [x] Checkbox checked → name + type + color shown — Task 1
- [x] Checkbox unchecked → name + parent radio list shown; type + color hidden (inherited via hidden inputs) — Task 1
- [x] `defaultParentId` pre-selects a parent and unchecks the checkbox — Task 1 (`initialIsMain` + `useState`)
- [x] Editing a top-level category → checkbox pre-checked — Task 1
- [x] Editing a subcategory → checkbox pre-unchecked, parent pre-selected — Task 1
- [x] Submit disabled when unchecked and no parent selected — Task 1
- [x] `mainCategories` derived from `tree` and passed to all `CategoryForm` usages — Task 2
- [x] `parentCategory` prop removed, replaced by `defaultParentId` — Tasks 1 + 2
- [x] Headings per state — Task 1
- [x] No server action changes — confirmed (no action tasks)

**No placeholders found.**

**Type consistency:** `CategoryFormProps` uses `mainCategories: Category[]` and `defaultParentId?: string`. `CategoryList` passes `mainCategories={mainCategories}` (typed `Category[]`) and `defaultParentId={parent.id}` (string). All consistent.

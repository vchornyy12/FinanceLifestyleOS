'use client'

import { useState, useActionState } from 'react'
import type { Category } from '@/types/database'
import { deleteCategory, type CategoryActionState } from '@/lib/actions/categories'
import CategoryForm from './CategoryForm'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryListProps {
  systemCategories: Category[]
  userCategories: Category[]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CategoryList({ systemCategories, userCategories }: CategoryListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------------------------------------------ */}
      {/* System defaults                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          System defaults
        </h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          These categories are built-in and cannot be edited or deleted.
        </p>
        <ul className="flex flex-col gap-2">
          {systemCategories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <ColorDot color={cat.color} />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{cat.name}</span>
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                System
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* User categories                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Your categories
          </h2>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              + Add category
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-4">
            <CategoryForm
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {/* User category rows */}
        {userCategories.length === 0 && !showCreateForm ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No custom categories yet. Add one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {userCategories.map((cat) => (
              <li key={cat.id} className="flex flex-col gap-2">
                {editingId === cat.id ? (
                  <CategoryForm
                    category={cat}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <UserCategoryRow
                    category={cat}
                    allCategories={[...systemCategories, ...userCategories]}
                    onEdit={() => setEditingId(cat.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserCategoryRow
// ---------------------------------------------------------------------------

interface UserCategoryRowProps {
  category: Category
  allCategories: Category[]
  onEdit: () => void
}

function UserCategoryRow({ category, allCategories, onEdit }: UserCategoryRowProps) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    deleteCategory,
    null,
  )

  // Possible categories to reassign to (excluding the category being deleted)
  const reassignOptions = allCategories.filter((c) => c.id !== category.id)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <ColorDot color={category.color} />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{category.name}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Edit button */}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Edit
          </button>

          {/* Delete form */}
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

      {/* Error message */}
      {state?.error && (
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      {/* Reassignment prompt */}
      {state?.requiresReassignment && (
        <ReassignPrompt
          categoryId={category.id}
          count={state.count ?? 0}
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
  options: Category[]
}

function ReassignPrompt({ categoryId, count, options }: ReassignPromptProps) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    deleteCategory,
    null,
  )

  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
      <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">
        This category is used by {count} transaction{count !== 1 ? 's' : ''}. Please reassign
        them to another category before deleting.
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
// ColorDot
// ---------------------------------------------------------------------------

interface ColorDotProps {
  color: string
}

function ColorDot({ color }: ColorDotProps) {
  return (
    <span
      className="block h-3 w-3 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

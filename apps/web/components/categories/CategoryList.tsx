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

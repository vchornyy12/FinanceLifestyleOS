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

'use client'

import { useActionState } from 'react'
import type { Category } from '@/types/database'
import { createCategory, updateCategory, type CategoryActionState } from '@/lib/actions/categories'

// ---------------------------------------------------------------------------
// 12 preset color swatches
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F59E0B',
  '#10B981',
  '#6B7280',
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryFormProps {
  /** When provided the form operates in edit mode; omit for create mode. */
  category?: Category
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CategoryForm({ category, onCancel }: CategoryFormProps) {
  const isEdit = category !== undefined

  const action = isEdit ? updateCategory : createCategory

  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(
    action,
    null,
  )

  const defaultColor = category?.color ?? PRESET_COLORS[5] // #3B82F6 blue

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Hidden id field for edit mode */}
      {isEdit && <input type="hidden" name="id" value={category.id} />}

      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {isEdit ? 'Edit category' : 'New category'}
      </h3>

      {/* Global error */}
      {state?.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* Name field */}
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
          placeholder="e.g. Groceries"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.name?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Color picker */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Color</p>
        <ColorPicker defaultColor={defaultColor} />
        {state?.fieldErrors?.color?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create category'}
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
// ColorPicker sub-component
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  defaultColor: string
}

function ColorPicker({ defaultColor }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category color">
      {PRESET_COLORS.map((color) => (
        <label
          key={color}
          className="relative cursor-pointer"
          aria-label={color}
        >
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

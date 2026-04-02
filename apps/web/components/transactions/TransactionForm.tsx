'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types/database'
import type { TransactionWithCategory } from '@/lib/supabase/queries/transactions'
import {
  createTransaction,
  updateTransaction,
  type TransactionActionState,
} from '@/lib/actions/transactions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionFormProps {
  categories: Category[]
  /** When provided the form operates in edit mode; omit for create mode. */
  transaction?: TransactionWithCategory
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransactionForm({ categories, transaction }: TransactionFormProps) {
  const router = useRouter()
  const isEdit = transaction !== undefined

  const action = isEdit ? updateTransaction : createTransaction

  const [state, formAction, isPending] = useActionState<TransactionActionState, FormData>(
    action,
    null,
  )

  // Navigate back to list on success
  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard/transactions')
    }
  }, [state?.success, router])

  // today in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().split('T')[0]

  // Pre-fill values for edit mode
  const defaultMerchant = transaction?.merchant ?? ''
  const defaultAmount = transaction ? parseFloat(transaction.amount).toFixed(2) : ''
  const defaultCategoryId = transaction?.category_id ?? ''
  const defaultDate = transaction?.date ?? today
  const defaultNote = transaction?.note ?? ''

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Hidden id for edit mode */}
      {isEdit && <input type="hidden" name="id" value={transaction.id} />}

      {/* Global error */}
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* Merchant */}
      <div>
        <label
          htmlFor="merchant"
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Merchant <span className="text-red-500">*</span>
        </label>
        <input
          id="merchant"
          name="merchant"
          type="text"
          required
          defaultValue={defaultMerchant}
          maxLength={200}
          placeholder="e.g. Biedronka"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.merchant?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Amount (PLN) <span className="text-red-500">*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          required
          step="0.01"
          min="0.01"
          defaultValue={defaultAmount}
          placeholder="0.00"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.amount?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category_id"
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={defaultCategoryId}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.category_id?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="date"
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Date <span className="text-red-500">*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          max={today}
          defaultValue={defaultDate}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.date?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Note */}
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Note <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={defaultNote}
          maxLength={500}
          placeholder="e.g. Weekly groceries run"
          className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
        />
        {state?.fieldErrors?.note?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {msg}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/transactions')}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

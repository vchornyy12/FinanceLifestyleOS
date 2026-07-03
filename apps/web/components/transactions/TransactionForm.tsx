'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TransactionType, WalletWithBalance } from '@/types/database'
import type { TransactionWithCategory } from '@/lib/supabase/queries/transactions'
import {
  createTransaction,
  updateTransaction,
  type TransactionActionState,
} from '@/lib/actions/transactions'

// ---------------------------------------------------------------------------
// Icon map (mirrors WalletCard)
// ---------------------------------------------------------------------------

const WALLET_ICON: Record<string, string> = {
  cash: '💵',
  debit: '🏦',
  credit_card: '💳',
  savings: '🏧',
  investment: '📈',
  crypto: '₿',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransactionFormProps {
  wallets: WalletWithBalance[]
  /** When provided the form operates in edit mode; omit for create mode. */
  transaction?: TransactionWithCategory
}

const TYPE_OPTIONS: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransactionForm({ wallets, transaction }: TransactionFormProps) {
  const router = useRouter()
  const isEdit = transaction !== undefined

  const action = isEdit ? updateTransaction : createTransaction

  const [state, formAction, isPending] = useActionState<TransactionActionState, FormData>(
    action,
    null,
  )

  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')

  useEffect(() => {
    if (state?.success) {
      router.push('/dashboard/transactions')
    }
  }, [state?.success, router])

  const today = new Date().toISOString().split('T')[0]

  const defaultMerchant = transaction?.merchant ?? ''
  const defaultAmount = transaction ? parseFloat(transaction.amount).toFixed(2) : ''
  const defaultCategoryId = transaction?.category_id ?? ''
  const defaultDate = transaction?.date ?? today
  const defaultNote = transaction?.note ?? ''
  const defaultWalletId = transaction?.wallet_id ?? ''
  const defaultFromWalletId = transaction?.from_wallet_id ?? ''
  const defaultToWalletId = transaction?.to_wallet_id ?? ''

  const isTransfer = type === 'transfer'
  const payeeLabel = type === 'income' ? 'Source' : 'Merchant'
  const payeePlaceholder = type === 'income' ? 'e.g. Employer' : 'e.g. Biedronka'

  const selectClassName =
    'w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40'

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-xl border border-mac-hairline bg-mac-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      {isEdit && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="type" value={type} />
      {/* Categories are auto-assigned; preserve the existing one across edits. */}
      {!isTransfer && defaultCategoryId && (
        <input type="hidden" name="category_id" value={defaultCategoryId} />
      )}

      {/* Global error */}
      {state?.error && (
        <p className="rounded-lg bg-mac-red/10 px-3 py-2 text-sm text-mac-red">
          {state.error}
        </p>
      )}

      {/* Type segmented control */}
      <div>
        <span className="mb-1 block text-xs font-medium text-mac-secondary">
          Type
        </span>
        <div
          role="tablist"
          aria-label="Transaction type"
          className="inline-flex rounded-lg bg-mac-label/8 p-0.5"
        >
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setType(opt.value)}
                className={
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors ' +
                  (active
                    ? 'bg-mac-surface text-mac-label shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    : 'text-mac-secondary hover:text-mac-label')
                }
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Merchant / Source (hidden for transfers) */}
      {!isTransfer && (
        <div>
          <label
            htmlFor="merchant"
            className="mb-1 block text-xs font-medium text-mac-secondary"
          >
            {payeeLabel} <span className="text-mac-red">*</span>
          </label>
          <input
            id="merchant"
            name="merchant"
            type="text"
            required
            defaultValue={defaultMerchant}
            maxLength={200}
            placeholder={payeePlaceholder}
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
          />
          {state?.fieldErrors?.merchant?.map((msg) => (
            <p key={msg} className="mt-1 text-xs text-mac-red">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Wallet selector (expense / income only) */}
      {!isTransfer && (
        <div>
          <label
            htmlFor="wallet_id"
            className="mb-1 block text-xs font-medium text-mac-secondary"
          >
            Wallet <span className="text-mac-tertiary">(optional)</span>
          </label>
          <select
            key={type}
            id="wallet_id"
            name="wallet_id"
            defaultValue={defaultWalletId}
            className={selectClassName}
          >
            <option value="">No wallet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {WALLET_ICON[w.type] ?? ''} {w.name}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.wallet_id?.map((msg) => (
            <p key={msg} className="mt-1 text-xs text-mac-red">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Transfer wallet selectors */}
      {isTransfer && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="from_wallet_id"
              className="mb-1 block text-xs font-medium text-mac-secondary"
            >
              From wallet <span className="text-mac-red">*</span>
            </label>
            <select
              id="from_wallet_id"
              name="from_wallet_id"
              required
              defaultValue={defaultFromWalletId}
              className={selectClassName}
            >
              <option value="">Select wallet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {WALLET_ICON[w.type] ?? ''} {w.name}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.from_wallet_id?.map((msg) => (
              <p key={msg} className="mt-1 text-xs text-mac-red">
                {msg}
              </p>
            ))}
          </div>
          <div>
            <label
              htmlFor="to_wallet_id"
              className="mb-1 block text-xs font-medium text-mac-secondary"
            >
              To wallet <span className="text-mac-red">*</span>
            </label>
            <select
              id="to_wallet_id"
              name="to_wallet_id"
              required
              defaultValue={defaultToWalletId}
              className={selectClassName}
            >
              <option value="">Select wallet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {WALLET_ICON[w.type] ?? ''} {w.name}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.to_wallet_id?.map((msg) => (
              <p key={msg} className="mt-1 text-xs text-mac-red">
                {msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Amount */}
      <div>
        <label
          htmlFor="amount"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Amount (PLN) <span className="text-mac-red">*</span>
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
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.fieldErrors?.amount?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">
            {msg}
          </p>
        ))}
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="date"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Date <span className="text-mac-red">*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          max={today}
          defaultValue={defaultDate}
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.fieldErrors?.date?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">
            {msg}
          </p>
        ))}
      </div>

      {/* Note */}
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Note <span className="text-mac-tertiary">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={defaultNote}
          maxLength={500}
          placeholder={
            isTransfer ? 'e.g. Topped up savings' : 'e.g. Weekly groceries run'
          }
          className="w-full resize-none rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.fieldErrors?.note?.map((msg) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">
            {msg}
          </p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-mac-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/transactions')}
          className="rounded-lg border border-mac-hairline bg-mac-elevated px-4 py-2 text-sm font-medium text-mac-label transition-colors hover:bg-mac-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

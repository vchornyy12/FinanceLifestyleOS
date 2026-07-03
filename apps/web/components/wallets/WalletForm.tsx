'use client'

import { useState, useActionState } from 'react'
import type { WalletRow } from '@/types/database'

const WALLET_TYPES = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'debit', label: '🏦 Debit' },
  { value: 'credit_card', label: '💳 Credit Card' },
  { value: 'savings', label: '🏧 Savings' },
  { value: 'investment', label: '📈 Investment' },
  { value: 'crypto', label: '₿ Crypto' },
] as const

type WalletActionResult = {
  errors?: Record<string, string[]>
  success?: boolean
} | null

interface WalletFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (state: any, formData: FormData) => Promise<WalletActionResult>
  wallet?: WalletRow
}

export default function WalletForm({ action, wallet }: WalletFormProps) {
  const isEdit = wallet !== undefined
  const [selectedType, setSelectedType] = useState(wallet?.type ?? 'cash')
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <form
      action={formAction}
      className="rounded-xl border border-mac-hairline bg-mac-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      {isEdit && <input type="hidden" name="id" value={wallet.id} />}

      {state?.errors?._ && (
        <p className="mb-3 rounded-lg bg-mac-red/10 px-3 py-2 text-sm text-mac-red">
          {state.errors._.join(', ')}
        </p>
      )}

      {/* Name */}
      <div className="mb-4">
        <label
          htmlFor="wallet-name"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Name
        </label>
        <input
          id="wallet-name"
          name="name"
          type="text"
          required
          defaultValue={wallet?.name ?? ''}
          maxLength={100}
          placeholder="e.g. Main checking"
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.errors?.name?.map((msg: string) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">{msg}</p>
        ))}
      </div>

      {/* Type — create only */}
      {!isEdit && (
        <div className="mb-4">
          <label
            htmlFor="wallet-type"
            className="mb-1 block text-xs font-medium text-mac-secondary"
          >
            Type
          </label>
          <select
            id="wallet-type"
            name="type"
            required
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as WalletRow['type'])}
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
          >
            {WALLET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {state?.errors?.type?.map((msg: string) => (
            <p key={msg} className="mt-1 text-xs text-mac-red">{msg}</p>
          ))}
        </div>
      )}

      {/* Currency */}
      <div className="mb-4">
        <label
          htmlFor="wallet-currency"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Currency
        </label>
        <input
          id="wallet-currency"
          name="currency"
          type="text"
          required
          defaultValue={wallet?.currency ?? 'PLN'}
          minLength={3}
          maxLength={3}
          placeholder="PLN"
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.errors?.currency?.map((msg: string) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">{msg}</p>
        ))}
      </div>

      {/* Opening balance */}
      <div className="mb-4">
        <label
          htmlFor="wallet-opening-balance"
          className="mb-1 block text-xs font-medium text-mac-secondary"
        >
          Opening balance
        </label>
        <input
          id="wallet-opening-balance"
          name="opening_balance"
          type="number"
          step="0.01"
          defaultValue={wallet?.opening_balance ?? 0}
          className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
        />
        {state?.errors?.opening_balance?.map((msg: string) => (
          <p key={msg} className="mt-1 text-xs text-mac-red">{msg}</p>
        ))}
      </div>

      {/* Credit limit — credit_card only */}
      {selectedType === 'credit_card' && (
        <div className="mb-4">
          <label
            htmlFor="wallet-credit-limit"
            className="mb-1 block text-xs font-medium text-mac-secondary"
          >
            Credit limit <span className="text-red-500">*</span>
          </label>
          <input
            id="wallet-credit-limit"
            name="credit_limit"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={wallet?.credit_limit ?? ''}
            placeholder="e.g. 5000.00"
            className="w-full rounded-lg border border-mac-hairline bg-mac-elevated px-3 py-2 text-sm text-mac-label placeholder-mac-tertiary focus:border-mac-accent focus:outline-none focus:ring-2 focus:ring-mac-accent/40"
          />
          {state?.errors?.credit_limit?.map((msg: string) => (
            <p key={msg} className="mt-1 text-xs text-mac-red">{msg}</p>
          ))}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-mac-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isEdit ? 'Update wallet' : 'Create wallet'}
        </button>
      </div>
    </form>
  )
}

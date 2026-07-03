'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { WalletWithBalance } from '@/types/database'
import { deleteWallet } from '@/lib/actions/wallets'

const TYPE_ICONS: Record<WalletWithBalance['type'], string> = {
  cash: '💵',
  debit: '🏦',
  credit_card: '💳',
  savings: '🏧',
  investment: '📈',
  crypto: '₿',
}

interface WalletCardProps {
  wallet: WalletWithBalance
}

export default function WalletCard({ wallet }: WalletCardProps) {
  const [state, formAction, isPending] = useActionState(deleteWallet, null)

  const icon = TYPE_ICONS[wallet.type]

  return (
    <div className="rounded-xl border border-mac-hairline bg-mac-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-mac-label">
            {wallet.name}
          </p>
          <p className="text-xs text-mac-tertiary">{wallet.currency}</p>
        </div>
      </div>

      {/* Balance info */}
      <div className="mb-4">
        {wallet.type === 'credit_card' && wallet.credit_limit != null ? (
          <dl className="space-y-1 text-xs text-mac-secondary">
            <div className="flex justify-between gap-2">
              <dt>Owed</dt>
              <dd className="font-medium text-mac-label">
                {wallet.balance.toFixed(2)} {wallet.currency}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Limit</dt>
              <dd className="font-medium text-mac-label">
                {wallet.credit_limit.toFixed(2)} {wallet.currency}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Available</dt>
              <dd className="font-medium text-mac-green">
                {(wallet.credit_limit - wallet.balance).toFixed(2)} {wallet.currency}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-lg font-semibold text-mac-label">
            {wallet.balance.toFixed(2)}{' '}
            <span className="text-sm font-normal text-mac-tertiary">
              {wallet.currency}
            </span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/wallets/${wallet.id}/edit`}
          className="rounded-md px-2 py-1 text-xs font-medium text-mac-secondary transition-colors hover:bg-mac-label/5 hover:text-mac-label"
        >
          Edit
        </Link>
        <form action={formAction}>
          <input type="hidden" name="id" value={wallet.id} />
          <button
            type="submit"
            disabled={isPending}
            onClick={(e) => {
              if (!confirm(`Delete "${wallet.name}"? This cannot be undone.`)) {
                e.preventDefault()
              }
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </form>
      </div>

      {state?.errors?._ && (
        <p className="mt-2 text-xs text-mac-red">
          {state.errors._.join(', ')}
        </p>
      )}
    </div>
  )
}

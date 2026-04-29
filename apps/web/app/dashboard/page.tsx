import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics, getAllTimeNet } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'

const PLN = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

const WALLET_ICONS: Record<string, string> = {
  cash: '💵',
  debit: '🏦',
  credit_card: '💳',
  savings: '🏧',
  investment: '📈',
  crypto: '₿',
}

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const yearMonth = currentYearMonth()
  const [metrics, allTimeNet, wallets] = await Promise.all([
    getMonthlyMetrics(yearMonth),
    getAllTimeNet(),
    getUserWalletsWithBalances(supabase),
  ])

  const savingsRate =
    metrics.income > 0 ? `${(((metrics.income - metrics.expense) / metrics.income) * 100).toFixed(0)}%` : '—'

  const cards: Array<{
    label: string
    value: string
    tone?: 'positive' | 'negative' | 'neutral'
    hint?: string
  }> = [
    {
      label: 'Total Balance',
      value: PLN.format(allTimeNet),
      tone: allTimeNet >= 0 ? 'positive' : 'negative',
      hint: 'All-time income − expense',
    },
    {
      label: 'Monthly Income',
      value: PLN.format(metrics.income),
      tone: 'positive',
    },
    {
      label: 'Monthly Expenses',
      value: PLN.format(metrics.expense),
      tone: 'negative',
    },
    {
      label: 'Savings Rate',
      value: savingsRate,
      tone: 'neutral',
      hint: 'This month',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Welcome back, {user.email ?? 'there'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s an overview of your finances.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const toneClass =
            card.tone === 'positive'
              ? 'text-emerald-600 dark:text-emerald-400'
              : card.tone === 'negative'
                ? 'text-red-600 dark:text-red-400'
                : 'text-zinc-900 dark:text-zinc-100'
          return (
            <div
              key={card.label}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {card.label}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{card.value}</p>
              {card.hint && (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{card.hint}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Wallet widgets */}
      {wallets.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Wallets</h2>
            <Link
              href="/dashboard/wallets"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {wallets.map((wallet) => {
              const icon = WALLET_ICONS[wallet.type] ?? '💰'
              const isCreditCard = wallet.type === 'credit_card' && wallet.credit_limit != null

              return (
                <Link
                  key={wallet.id}
                  href={`/dashboard/wallets/${wallet.id}/edit`}
                  className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {wallet.name}
                      </p>
                      <p className="text-xs capitalize text-zinc-400 dark:text-zinc-500">
                        {wallet.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {isCreditCard ? (
                    <dl className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between gap-2">
                        <dt>Owed</dt>
                        <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                          {formatAmount(wallet.balance, wallet.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Available</dt>
                        <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatAmount(wallet.credit_limit! - wallet.balance, wallet.currency)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatAmount(wallet.balance, wallet.currency)}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

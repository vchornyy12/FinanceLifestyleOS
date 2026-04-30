import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import { getTopProducts } from '@/lib/supabase/queries/receiptItems'
import { fetchRatesFromEUR, convertToPLN } from '@/lib/currency'

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
  const [metrics, wallets, { rates: ratesFromEUR, date: ratesDate }, topProducts] = await Promise.all([
    getMonthlyMetrics(yearMonth),
    getUserWalletsWithBalances(supabase),
    fetchRatesFromEUR(),
    getTopProducts(yearMonth),
  ])

  // Sum all wallet balances converted to PLN.
  // Credit card balances represent money owed (liability), so subtract them.
  const walletTotalPLN = wallets.reduce((sum, w) => {
    const balancePLN = convertToPLN(w.balance, w.currency, ratesFromEUR)
    return w.type === 'credit_card' ? sum - balancePLN : sum + balancePLN
  }, 0)

  const hasMultiCurrency = wallets.some((w) => w.currency !== 'PLN')
  const totalBalanceHint = hasMultiCurrency && ratesDate
    ? `Wallets converted to PLN · rates ${ratesDate}`
    : 'Sum of all wallet balances'

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
      value: PLN.format(walletTotalPLN),
      tone: walletTotalPLN >= 0 ? 'positive' : 'negative',
      hint: totalBalanceHint,
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

      {/* Receipt upload shortcut */}
      <section>
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Upload a receipt
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Scan any grocery or store receipt to track spending by product.
            </p>
          </div>
          <Link
            href="/dashboard/receipts/upload"
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Upload
          </Link>
        </div>
      </section>

      {/* Top Products This Month */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Top Products This Month
        </h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No receipt data yet. Scan a receipt on mobile to see product-level spending.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topProducts.map((product, i) => (
                <li key={product.name} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-5 text-right text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {product.name}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    ×{product.count}
                  </span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {PLN.format(product.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

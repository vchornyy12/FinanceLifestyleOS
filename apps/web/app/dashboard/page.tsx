import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import { getMonthlyCategoryBreakdown } from '@/lib/supabase/queries/categoryBreakdown'
import { getTransactions } from '@/lib/supabase/queries/transactions'
import { fetchRatesFromEUR, convertToPLN } from '@/lib/currency'
import QuickUpload from '@/components/receipts/QuickUpload'

const PLN = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const DATE_FMT = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'short' })

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const yearMonth = currentYearMonth()
  const [metrics, wallets, { rates: ratesFromEUR, date: ratesDate }, breakdown, recent] =
    await Promise.all([
      getMonthlyMetrics(yearMonth),
      getUserWalletsWithBalances(supabase),
      fetchRatesFromEUR(),
      getMonthlyCategoryBreakdown(yearMonth),
      getTransactions(undefined, 10),
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

  const cards: Array<{
    label: string
    value: string
    tone: 'positive' | 'negative'
    hint?: string
  }> = [
    {
      label: 'Monthly Income',
      value: PLN.format(metrics.income),
      tone: 'positive',
      hint: 'This month',
    },
    {
      label: 'Monthly Expenses',
      value: PLN.format(metrics.expense),
      tone: 'negative',
      hint: 'This month',
    },
    {
      label: 'Total Balance',
      value: PLN.format(walletTotalPLN),
      tone: walletTotalPLN >= 0 ? 'positive' : 'negative',
      hint: totalBalanceHint,
    },
  ]

  const maxCategoryTotal = breakdown[0]?.total ?? 0

  return (
    <div className="flex flex-col gap-8">
      {/* Upload — the one thing to do here */}
      <QuickUpload />

      {/* Income / Expenses / Balance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                card.tone === 'positive'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {card.value}
            </p>
            {card.hint && (
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{card.hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Spending by category (auto-assigned) */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Where it went this month
        </h2>
        {breakdown.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No expenses yet this month. Upload a receipt above to get started.
          </p>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="flex flex-col gap-3">
              {breakdown.map((cat) => (
                <li key={cat.categoryId ?? 'other'} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {cat.name}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${maxCategoryTotal > 0 ? Math.max(2, (cat.total / maxCategoryTotal) * 100) : 0}%`,
                        backgroundColor: cat.color ?? '#71717a',
                      }}
                    />
                  </span>
                  <span className="w-24 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {PLN.format(cat.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recent transactions
          </h2>
          <Link
            href="/dashboard/transactions"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No transactions yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recent.map((tx) => {
                const isIncome = tx.type === 'income'
                const amount = Number(tx.amount)
                return (
                  <li key={tx.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-14 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                      {DATE_FMT.format(new Date(tx.date))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {tx.merchant || tx.note || (isIncome ? 'Income' : 'Expense')}
                    </span>
                    {tx.category && (
                      <span className="hidden shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 sm:inline dark:bg-zinc-800 dark:text-zinc-400">
                        {tx.category.name}
                      </span>
                    )}
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? '+' : '−'}{PLN.format(Math.abs(amount))}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

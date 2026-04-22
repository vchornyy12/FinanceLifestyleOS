import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics, getAllTimeNet } from '@/lib/supabase/queries/metrics'

const PLN = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

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
  const [metrics, allTimeNet] = await Promise.all([
    getMonthlyMetrics(yearMonth),
    getAllTimeNet(),
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
    </div>
  )
}

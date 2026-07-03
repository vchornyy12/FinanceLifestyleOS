import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import TransactionForm from '@/components/transactions/TransactionForm'

export const metadata = {
  title: 'New Transaction | Finance Lifestyle OS',
}

export default async function NewTransactionPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user wallets for the wallet selector
  const wallets = await getUserWalletsWithBalances(supabase)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          New transaction
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Record a new financial transaction manually.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-lg">
        <TransactionForm wallets={wallets} />
      </div>
    </div>
  )
}

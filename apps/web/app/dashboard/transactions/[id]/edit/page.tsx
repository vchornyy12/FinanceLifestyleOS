import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TransactionWithCategory } from '@/lib/supabase/queries/transactions'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import TransactionForm from '@/components/transactions/TransactionForm'

export const metadata = {
  title: 'Edit Transaction | Finance Lifestyle OS',
}

interface EditTransactionPageProps {
  params: Promise<{ id: string }>
}

export default async function EditTransactionPage({ params }: EditTransactionPageProps) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch the transaction with its category join
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*, category:categories(id, name, color)')
    .eq('id', id)
    .single()

  if (txError || !transaction) {
    redirect('/dashboard/transactions')
  }

  // Fetch user wallets for the wallet selector
  const wallets = await getUserWalletsWithBalances(supabase)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Edit transaction
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Update the details of this transaction.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-lg">
        <TransactionForm
          wallets={wallets}
          transaction={transaction as TransactionWithCategory}
        />
      </div>
    </div>
  )
}

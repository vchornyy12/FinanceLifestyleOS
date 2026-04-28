import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import WalletCard from '@/components/wallets/WalletCard'

export const metadata = {
  title: 'Wallets | Finance Lifestyle OS',
}

export default async function WalletsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const wallets = await getUserWalletsWithBalances(supabase)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Wallets</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your accounts and track balances.
          </p>
        </div>
        <Link
          href="/dashboard/wallets/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add Wallet
        </Link>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No wallets yet.{' '}
            <Link
              href="/dashboard/wallets/new"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Add your first wallet
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      )}
    </div>
  )
}

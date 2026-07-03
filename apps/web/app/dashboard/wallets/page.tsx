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
          <h1 className="text-2xl font-semibold text-mac-label">Wallets</h1>
          <p className="mt-1 text-sm text-mac-secondary">
            Manage your accounts and track balances.
          </p>
        </div>
        <Link
          href="/dashboard/wallets/new"
          className="rounded-lg bg-mac-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Add Wallet
        </Link>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-mac-hairline bg-mac-surface p-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-mac-secondary">
            No wallets yet.{' '}
            <Link
              href="/dashboard/wallets/new"
              className="font-medium text-mac-accent underline-offset-2 hover:underline"
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

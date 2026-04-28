import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createWallet } from '@/lib/actions/wallets'
import WalletForm from '@/components/wallets/WalletForm'

export const metadata = {
  title: 'New Wallet | Finance Lifestyle OS',
}

async function createWalletAndRedirect(_: unknown, formData: FormData) {
  'use server'
  const result = await createWallet(_, formData)
  if (result.success) {
    redirect('/dashboard/wallets')
  }
  return result
}

export default async function NewWalletPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">New wallet</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add a new account to track its balance and transactions.
        </p>
      </div>

      <div className="max-w-lg">
        <WalletForm action={createWalletAndRedirect} />
      </div>
    </div>
  )
}

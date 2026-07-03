import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateWallet } from '@/lib/actions/wallets'
import WalletForm from '@/components/wallets/WalletForm'
import type { WalletRow } from '@/types/database'

export const metadata = {
  title: 'Edit Wallet | Finance Lifestyle OS',
}

async function updateWalletAndRedirect(_: unknown, formData: FormData) {
  'use server'
  const result = await updateWallet(_, formData)
  if (result.success) {
    redirect('/dashboard/wallets')
  }
  return result
}

interface EditWalletPageProps {
  params: Promise<{ id: string }>
}

export default async function EditWalletPage({ params }: EditWalletPageProps) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: wallet, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !wallet) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-mac-label">Edit wallet</h1>
        <p className="mt-1 text-sm text-mac-secondary">
          Update the details of this wallet.
        </p>
      </div>

      <div className="max-w-lg">
        <WalletForm action={updateWalletAndRedirect} wallet={wallet as WalletRow} />
      </div>
    </div>
  )
}

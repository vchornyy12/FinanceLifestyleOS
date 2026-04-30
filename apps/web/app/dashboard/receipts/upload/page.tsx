import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import ReceiptUploader from '@/components/receipts/ReceiptUploader'
import { saveReceipt } from './actions'

export const metadata = {
  title: 'Upload Receipt | Finance Lifestyle OS',
}

export default async function ReceiptUploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [wallets, { data: categoriesData }] = await Promise.all([
    getUserWalletsWithBalances(supabase),
    supabase.from('categories').select('id, name').order('name'),
  ])

  const categories = categoriesData ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Upload Receipt
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Scan a receipt to automatically extract and record your purchases.
        </p>
      </div>

      <ReceiptUploader
        wallets={wallets}
        categories={categories}
        onSave={saveReceipt}
      />
    </div>
  )
}

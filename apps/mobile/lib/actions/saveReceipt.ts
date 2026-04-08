import { supabase } from '@/lib/supabase'
import { ReviewItem, ParsedReceipt } from '@/types/receipt'

interface Category {
  id: string
  name: string
}

export async function saveReceipt(
  items: ReviewItem[],
  receipt: ParsedReceipt,
  storagePath: string,
  categories: Category[],
): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const categoryMap = new Map<string, string>(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  )

  const transactions = items.map((item) => ({
    user_id: user.id,
    category_id: item.category ? (categoryMap.get(item.category.toLowerCase()) ?? null) : null,
    amount: item.total_price.toFixed(2),
    merchant: receipt.store,
    note: item.name,
    date: receipt.date,
    source: 'ocr' as const,
    receipt_url: storagePath,
  }))

  const { error } = await supabase.from('transactions').insert(transactions)
  if (error) {
    throw new Error('Failed to save transactions')
  }
}

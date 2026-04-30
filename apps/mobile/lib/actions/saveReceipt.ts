import { supabase } from '@/lib/supabase'
import { ReviewItem, ParsedReceipt } from '@/types/receipt'
import type { ReceiptItemInsert } from '@/types/database'

interface Category {
  id: string
  name: string
}

export async function saveReceipt(
  items: ReviewItem[],
  receipt: ParsedReceipt,
  storagePath: string,
  categories: Category[],
  walletId: string | null = null,
): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const categoryMap = new Map<string, string>(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  )

  // One parent transaction row representing the total receipt purchase.
  const total = items.reduce((sum, item) => sum + item.total_price, 0)

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'expense' as const,
      amount: total.toFixed(2),
      merchant: receipt.store,
      date: receipt.date,
      source: 'ocr' as const,
      receipt_url: storagePath,
      wallet_id: walletId,
    })
    .select('id')
    .single()

  if (txError || !txData) {
    throw new Error('Failed to save receipt transaction')
  }

  // N receipt_items rows — one per line item from the OCR result.
  const receiptItems: ReceiptItemInsert[] = items.map((item) => ({
    transaction_id: txData.id,
    user_id: user.id,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: item.category
      ? (categoryMap.get(item.category.toLowerCase()) ?? null)
      : null,
    confidence: item.confidence,
  }))

  const { error: itemsError } = await supabase
    .from('receipt_items')
    .insert(receiptItems)

  if (itemsError) {
    throw new Error('Failed to save receipt items')
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'

export interface ReviewedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string | null
  confidence: 'high' | 'low'
}

export interface SaveReceiptInput {
  store: string
  date: string
  wallet_id: string | null
  total: number
  items: ReviewedItem[]
}

export async function saveReceipt(
  input: SaveReceiptInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'expense',
      amount: String(input.total),
      merchant: input.store,
      date: input.date,
      wallet_id: input.wallet_id || null,
      source: 'ocr',
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return { error: `Failed to save transaction: ${txError?.message}` }
  }

  const rows = input.items.map((item) => ({
    transaction_id: tx.id,
    user_id: user.id,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: item.category_id || null,
    confidence: item.confidence,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(rows)
  if (itemsError) {
    return { error: `Failed to save items: ${itemsError.message}` }
  }

  return {}
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { upsertCategoryLearning } from '@/lib/supabase/queries/categoryLearning'

export interface ReviewedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string | null
  confidence: 'high' | 'low'
  raw_name?: string
  normalized_name?: string | null
  canonical_product_name?: string | null
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  flavor?: string | null
  variant?: string | null
  barcode?: string | null
  gtin?: string | null
  normalization_confidence?: number | null
  enrichment_confidence?: number | null
  normalization_source?: string | null
  enrichment_source?: string | null
  needs_review?: boolean
  user_confirmed?: boolean
  product_fingerprint?: string | null
  // Category learning fields
  history_category_id?: string | null
  user_changed_category?: boolean
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
    raw_name: item.raw_name ?? item.name,
    normalized_name: item.normalized_name ?? null,
    canonical_product_name: item.canonical_product_name ?? null,
    brand: item.brand ?? null,
    size_value: item.size_value ?? null,
    size_unit: item.size_unit ?? null,
    flavor: item.flavor ?? null,
    variant: item.variant ?? null,
    barcode: item.barcode ?? null,
    gtin: item.gtin ?? null,
    normalization_confidence: item.normalization_confidence ?? null,
    enrichment_confidence: item.enrichment_confidence ?? null,
    normalization_source: item.normalization_source ?? 'ocr',
    enrichment_source: item.enrichment_source ?? null,
    needs_review: item.needs_review ?? false,
    user_confirmed: item.user_confirmed ?? false,
    product_fingerprint: item.product_fingerprint ?? null,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(rows)
  if (itemsError) {
    return { error: `Failed to save items: ${itemsError.message}` }
  }

  // Category learning: upsert for every item that has a raw_name and a category.
  // Corrections (user_changed_category=true) are weighted higher than passive saves.
  const learningItems = input.items.filter(
    (item) => item.category_id && (item.raw_name ?? item.name),
  )
  await Promise.allSettled(
    learningItems.map((item) =>
      upsertCategoryLearning(
        supabase,
        user.id,
        item.raw_name ?? item.name,
        item.normalized_name ?? null,
        input.store || null,
        item.category_id!,
        item.user_changed_category === true,
      ),
    ),
  )

  return {}
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertCategoryLearning } from '../supabase/queries/categoryLearning'
import { resolveCategoryId } from './resolveCategory'

export interface EnrichedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category?: string
  confidence: 'high' | 'low'
  raw_name?: string
  normalized_name?: string | null
  canonical_product_name?: string | null
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  flavor?: string | null
  variant?: string | null
  gtin?: string | null
  normalization_confidence?: number | null
  enrichment_confidence?: number | null
  normalization_source?: string | null
  enrichment_source?: string | null
  needs_review?: boolean
  product_fingerprint?: string | null
  history_category_id?: string | null
}

export interface EnrichedReceipt {
  store: string
  date: string
  total: number
  items: EnrichedItem[]
}

/**
 * Zero-touch save: insert the parsed receipt as an expense transaction with
 * receipt_items, categorized without user input. Used by the background OCR
 * function with a service-role client, so userId must be passed explicitly.
 * Throws on failure; caller marks the job as errored.
 */
export async function autoSaveReceipt(
  supabase: SupabaseClient,
  userId: string,
  receipt: EnrichedReceipt,
): Promise<{ transactionId: string }> {
  const [{ data: categories, error: catError }, { data: wallets, error: walletError }] =
    await Promise.all([
      supabase.from('categories').select('id, name').eq('user_id', userId),
      supabase
        .from('wallets')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1),
    ])
  if (catError) throw new Error(`categories lookup failed: ${catError.message}`)
  if (walletError) throw new Error(`wallet lookup failed: ${walletError.message}`)

  const userCategories = categories ?? []
  const walletId = wallets?.[0]?.id ?? null

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'expense',
      amount: String(receipt.total),
      merchant: receipt.store,
      date: receipt.date,
      wallet_id: walletId,
      source: 'ocr',
    })
    .select('id')
    .single()
  if (txError || !tx) throw new Error(`transaction insert failed: ${txError?.message}`)

  const itemRows = receipt.items.map((item) => ({
    transaction_id: tx.id,
    user_id: userId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category_id: resolveCategoryId(item, userCategories),
    confidence: item.confidence,
    raw_name: item.raw_name ?? item.name,
    normalized_name: item.normalized_name ?? null,
    canonical_product_name: item.canonical_product_name ?? null,
    brand: item.brand ?? null,
    size_value: item.size_value ?? null,
    size_unit: item.size_unit ?? null,
    flavor: item.flavor ?? null,
    variant: item.variant ?? null,
    gtin: item.gtin ?? null,
    normalization_confidence: item.normalization_confidence ?? null,
    enrichment_confidence: item.enrichment_confidence ?? null,
    normalization_source: item.normalization_source ?? 'ocr',
    enrichment_source: item.enrichment_source ?? null,
    needs_review: item.needs_review ?? false,
    user_confirmed: false,
    product_fingerprint: item.product_fingerprint ?? null,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(itemRows)
  if (itemsError) throw new Error(`receipt_items insert failed: ${itemsError.message}`)

  // Passive learning: every auto-categorized item reinforces the mapping.
  await Promise.allSettled(
    receipt.items.map((item, i) => {
      const categoryId = itemRows[i].category_id
      if (!categoryId) return Promise.resolve()
      return upsertCategoryLearning(
        supabase,
        userId,
        item.raw_name ?? item.name,
        item.normalized_name ?? null,
        receipt.store || null,
        categoryId,
        false,
      )
    }),
  )

  return { transactionId: tx.id }
}

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CategoryHistoryMatch {
  category_id: string
  confidence: number
  tier: number
}

export async function lookupCategoryFromHistory(
  supabase: SupabaseClient,
  userId: string,
  rawName: string,
  normalizedName: string | null,
  retailer: string | null,
): Promise<CategoryHistoryMatch | null> {
  const { data, error } = await supabase.rpc('lookup_category_from_history', {
    p_user_id: userId,
    p_raw_name: rawName,
    p_normalized_name: normalizedName ?? null,
    p_retailer: retailer ?? null,
  })
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null
  const row = Array.isArray(data) ? data[0] : data
  return row as CategoryHistoryMatch
}

export async function upsertCategoryLearning(
  supabase: SupabaseClient,
  userId: string,
  rawName: string,
  normalizedName: string | null,
  retailer: string | null,
  categoryId: string,
  isCorrection: boolean,
): Promise<void> {
  await supabase.rpc('upsert_category_learning', {
    p_user_id: userId,
    p_raw_name: rawName.toUpperCase(),
    p_normalized_name: normalizedName ?? null,
    p_retailer: retailer ?? null,
    p_category_id: categoryId,
    p_is_correction: isCorrection,
  })
}

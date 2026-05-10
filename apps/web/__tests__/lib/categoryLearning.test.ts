import { describe, it, expect, vi } from 'vitest'
import {
  lookupCategoryFromHistory,
  upsertCategoryLearning,
} from '@/lib/supabase/queries/categoryLearning'
import type { SupabaseClient } from '@supabase/supabase-js'

const CATEGORY_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeSupabase(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as unknown as SupabaseClient
}

describe('lookupCategoryFromHistory', () => {
  it('returns null when RPC returns empty array', async () => {
    const sb = makeSupabase({ data: [], error: null })
    expect(await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka')).toBeNull()
  })

  it('returns null when RPC errors', async () => {
    const sb = makeSupabase({ data: null, error: new Error('rpc failed') })
    expect(await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', null)).toBeNull()
  })

  it('returns the first match', async () => {
    const sb = makeSupabase({
      data: [{ category_id: CATEGORY_UUID, confidence: 0.9, tier: 1 }],
      error: null,
    })
    const result = await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka')
    expect(result).toEqual({ category_id: CATEGORY_UUID, confidence: 0.9, tier: 1 })
  })

  it('passes null retailer to RPC', async () => {
    const sb = makeSupabase({ data: [], error: null })
    await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', 'mleko', null)
    expect(sb.rpc).toHaveBeenCalledWith(
      'lookup_category_from_history',
      expect.objectContaining({ p_retailer: null }),
    )
  })

  it('passes null normalized_name to RPC when null provided', async () => {
    const sb = makeSupabase({ data: [], error: null })
    await lookupCategoryFromHistory(sb, USER_UUID, 'MLEKO', null, null)
    expect(sb.rpc).toHaveBeenCalledWith(
      'lookup_category_from_history',
      expect.objectContaining({ p_normalized_name: null }),
    )
  })
})

describe('upsertCategoryLearning', () => {
  it('calls RPC with p_is_correction=true for corrections', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'MLEKO', 'mleko', 'Biedronka', CATEGORY_UUID, true)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_is_correction: true, p_category_id: CATEGORY_UUID }),
    )
  })

  it('calls RPC with p_is_correction=false for passive saves', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'MLEKO', 'mleko', null, CATEGORY_UUID, false)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_is_correction: false }),
    )
  })

  it('uppercases raw_name before passing to RPC', async () => {
    const sb = makeSupabase({ data: null, error: null })
    await upsertCategoryLearning(sb, USER_UUID, 'mleko', 'mleko', null, CATEGORY_UUID, false)
    expect(sb.rpc).toHaveBeenCalledWith(
      'upsert_category_learning',
      expect.objectContaining({ p_raw_name: 'MLEKO' }),
    )
  })
})

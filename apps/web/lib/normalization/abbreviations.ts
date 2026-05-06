import { createClient } from '@/lib/supabase/server'
import { normalizePolish } from './polish'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AbbreviationMatch {
  normalized: string
  canonical_product_name: string | null
  confidence: number
  source: 'user' | 'global'
}

interface GlobalMapping {
  retailer: string | null
  raw_pattern: string
  normalized_name: string
  canonical_product_name: string | null
}

interface UserMapping {
  retailer: string | null
  raw_name: string
  normalized_name: string
  canonical_product_name: string | null
}

// In-process cache for global mappings — reloaded on cold start.
// Key: `${retailer ?? ''}:${raw_pattern_uppercased}`
let globalCache: Map<string, GlobalMapping> | null = null

async function loadGlobalMappings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
): Promise<Map<string, GlobalMapping>> {
  if (globalCache) return globalCache

  const { data, error } = await client
    .from('global_retailer_name_mappings')
    .select('retailer, raw_pattern, normalized_name, canonical_product_name')

  if (error) {
    console.error('[abbreviations] failed to load global mappings:', error.message)
    return new Map()
  }

  globalCache = new Map(
    (data as GlobalMapping[]).map((row) => [
      `${row.retailer ?? ''}:${row.raw_pattern.toUpperCase()}`,
      row,
    ]),
  )
  return globalCache
}

export async function expandAbbreviation(
  raw: string,
  userId: string,
  retailer?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: SupabaseClient<any>,
): Promise<AbbreviationMatch | null> {
  const normalized = normalizePolish(raw)

  // Resolve which client to use (admin client from parse route, or cookie client from server actions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: SupabaseClient<any> = supabaseClient ?? await createClient()

  // Tier 1: user-specific mappings (highest priority)
  const userQuery = client
    .from('receipt_item_name_mappings')
    .select('retailer, raw_name, normalized_name, canonical_product_name')
    .eq('user_id', userId)
    .eq('raw_name', raw.toUpperCase())

  if (retailer) {
    const { data: userRows } = await userQuery
    const match = (userRows as UserMapping[] | null)?.find(
      (r) => r.retailer === retailer || r.retailer === null,
    )
    if (match) {
      return {
        normalized: match.normalized_name,
        canonical_product_name: match.canonical_product_name,
        confidence: 1.0,
        source: 'user',
      }
    }
  } else {
    const { data: userRows } = await userQuery.is('retailer', null)
    const match = (userRows as UserMapping[] | null)?.[0]
    if (match) {
      return {
        normalized: match.normalized_name,
        canonical_product_name: match.canonical_product_name,
        confidence: 1.0,
        source: 'user',
      }
    }
  }

  // Tier 2: global dictionary
  const globals = await loadGlobalMappings(client)

  const retailerKey = `${retailer ?? ''}:${normalized}`
  const catchAllKey = `:${normalized}`

  const globalMatch = globals.get(retailerKey) ?? globals.get(catchAllKey)
  if (globalMatch) {
    return {
      normalized: globalMatch.normalized_name,
      canonical_product_name: globalMatch.canonical_product_name,
      confidence: 0.9,
      source: 'global',
    }
  }

  return null
}

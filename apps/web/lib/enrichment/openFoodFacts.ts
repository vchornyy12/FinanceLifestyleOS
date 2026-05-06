import type { EnrichmentResult, ProductEnrichmentProvider } from './types'

const OFF_BASE = 'https://world.openfoodfacts.org'
const SEARCH_BASE = 'https://world.openfoodfacts.org/cgi/search.pl'
const TIMEOUT_MS = 5_000

// Simple LRU cache (max 500 entries) — lives in process memory, resets on cold start
const cache = new Map<string, EnrichmentResult | null>()
const MAX_CACHE = 500

function cacheSet(key: string, value: EnrichmentResult | null): void {
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, value)
}

// Per-process rate limit: 1 req/sec (not per user — good enough for MVP)
let lastRequestAt = 0

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now()
  const wait = 1_000 - (now - lastRequestAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
}

interface OFFProduct {
  product_name?: string
  brands?: string
  quantity?: string
  code?: string
  categories_tags?: string[]
  nutriscore_score?: number
}

function mapProduct(product: OFFProduct): EnrichmentResult {
  return {
    canonical_product_name: product.product_name ?? null,
    brand: product.brands ?? null,
    quantity: product.quantity ?? null,
    gtin: product.code ?? null,
    categories: product.categories_tags ?? [],
    // OFF doesn't give a match_score for barcode lookups; use 0.85 as heuristic
    confidence: 0.85,
    source: 'openfoodfacts',
  }
}

export class OpenFoodFactsProvider implements ProductEnrichmentProvider {
  async lookup({ barcode, name }: { barcode?: string; name?: string }): Promise<EnrichmentResult | null> {
    try {
      if (barcode) {
        const cacheKey = `barcode:${barcode}`
        if (cache.has(cacheKey)) return cache.get(cacheKey)!

        const res = await throttledFetch(`${OFF_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json`)
        if (!res.ok) { cacheSet(cacheKey, null); return null }
        const json = await res.json() as { status: number; product?: OFFProduct }
        if (json.status !== 1 || !json.product) { cacheSet(cacheKey, null); return null }

        const result = mapProduct(json.product)
        cacheSet(cacheKey, result)
        return result
      }

      if (name) {
        const cacheKey = `name:${name.toLowerCase()}`
        if (cache.has(cacheKey)) return cache.get(cacheKey)!

        const params = new URLSearchParams({
          search_terms: name,
          search_simple: '1',
          action: 'process',
          json: '1',
          page_size: '1',
          lc: 'pl',
          cc: 'pl',
        })
        const res = await throttledFetch(`${SEARCH_BASE}?${params}`)
        if (!res.ok) { cacheSet(cacheKey, null); return null }
        const json = await res.json() as { products?: OFFProduct[] }
        const product = json.products?.[0]
        if (!product) { cacheSet(cacheKey, null); return null }

        const result = { ...mapProduct(product), confidence: 0.6 }
        cacheSet(cacheKey, result)
        return result
      }

      return null
    } catch {
      // Fail open — enrichment is optional, never block receipt save
      return null
    }
  }
}

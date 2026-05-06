export interface EnrichmentResult {
  canonical_product_name: string | null
  brand: string | null
  quantity: string | null
  gtin: string | null
  categories: string[]
  confidence: number
  source: 'openfoodfacts' | 'gs1' | 'manual' | 'none'
}

export interface ProductEnrichmentProvider {
  lookup(options: { barcode?: string; name?: string }): Promise<EnrichmentResult | null>
}

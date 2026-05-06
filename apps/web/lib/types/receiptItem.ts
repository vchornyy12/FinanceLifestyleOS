export interface ReceiptItemWithEnrichment {
  id: string
  transaction_id: string
  user_id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string | null

  // Normalization fields
  raw_name: string
  normalized_name: string | null
  canonical_product_name: string | null
  brand: string | null
  size_value: number | null
  size_unit: string | null
  flavor: string | null
  variant: string | null
  barcode: string | null
  gtin: string | null
  normalization_confidence: number | null
  enrichment_confidence: number | null
  normalization_source: 'ocr' | 'rule' | 'dictionary' | 'ai' | 'openfoodfacts' | 'gs1' | 'user' | null
  enrichment_source: 'openfoodfacts' | 'gs1' | 'manual' | 'none' | null
  needs_review: boolean
  user_confirmed: boolean
  product_fingerprint: string | null
}

export interface LegacyReceiptItem {
  id?: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string | null
}

export interface ReceiptItemDisplay {
  displayName: string
  rawName: string
  quantity: number
  unit_price: number
  total_price: number
  category: string | null
  needsReview: boolean
  normalizationConfidence: number | null
}

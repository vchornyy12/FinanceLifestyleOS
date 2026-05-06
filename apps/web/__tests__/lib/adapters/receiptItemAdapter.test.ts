import { describe, it, expect } from 'vitest'
import { toDisplay } from '@/lib/adapters/receiptItemAdapter'
import type { ReceiptItemWithEnrichment, LegacyReceiptItem } from '@/lib/types/receiptItem'

const BASE = {
  quantity: 1,
  unit_price: 3.99,
  total_price: 3.99,
  category: 'Nabiał',
}

describe('toDisplay fallback chain', () => {
  it('uses canonical_product_name when available', () => {
    const item: ReceiptItemWithEnrichment = {
      ...BASE,
      id: '1',
      transaction_id: 'tx',
      user_id: 'u',
      name: 'JOG',
      raw_name: 'JOG',
      normalized_name: 'jogurt',
      canonical_product_name: 'Jogurt truskawkowy Piątnica',
      brand: 'Piątnica',
      size_value: 150,
      size_unit: 'g',
      flavor: 'truskawkowy',
      variant: null,
      barcode: null,
      gtin: null,
      normalization_confidence: 0.9,
      enrichment_confidence: 0.85,
      normalization_source: 'dictionary',
      enrichment_source: 'openfoodfacts',
      needs_review: false,
      user_confirmed: false,
      product_fingerprint: 'abc123',
    }
    const display = toDisplay(item)
    expect(display.displayName).toBe('Jogurt truskawkowy Piątnica')
  })

  it('falls back to normalized_name when canonical is null', () => {
    const item: ReceiptItemWithEnrichment = {
      ...BASE,
      id: '1',
      transaction_id: 'tx',
      user_id: 'u',
      name: 'JOG',
      raw_name: 'JOG',
      normalized_name: 'jogurt',
      canonical_product_name: null,
      brand: null,
      size_value: null,
      size_unit: null,
      flavor: null,
      variant: null,
      barcode: null,
      gtin: null,
      normalization_confidence: 0.9,
      enrichment_confidence: null,
      normalization_source: 'dictionary',
      enrichment_source: null,
      needs_review: false,
      user_confirmed: false,
      product_fingerprint: null,
    }
    const display = toDisplay(item)
    expect(display.displayName).toBe('jogurt')
  })

  it('falls back to name when both canonical and normalized are null', () => {
    const item: ReceiptItemWithEnrichment = {
      ...BASE,
      id: '1',
      transaction_id: 'tx',
      user_id: 'u',
      name: 'JOG',
      raw_name: 'JOG',
      normalized_name: null,
      canonical_product_name: null,
      brand: null,
      size_value: null,
      size_unit: null,
      flavor: null,
      variant: null,
      barcode: null,
      gtin: null,
      normalization_confidence: null,
      enrichment_confidence: null,
      normalization_source: 'ocr',
      enrichment_source: null,
      needs_review: true,
      user_confirmed: false,
      product_fingerprint: null,
    }
    const display = toDisplay(item)
    expect(display.displayName).toBe('JOG')
    expect(display.needsReview).toBe(true)
  })

  it('handles legacy items without enrichment fields', () => {
    const item: LegacyReceiptItem = {
      ...BASE,
      name: 'Chleb',
    }
    const display = toDisplay(item)
    expect(display.displayName).toBe('Chleb')
    expect(display.rawName).toBe('Chleb')
    expect(display.needsReview).toBe(false)
    expect(display.normalizationConfidence).toBeNull()
  })
})

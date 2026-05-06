import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the abbreviations module so normalize tests run without a DB connection
vi.mock('@/lib/normalization/abbreviations', () => ({
  expandAbbreviation: vi.fn(async (raw: string, _userId: string, retailer?: string) => {
    const DICT: Record<string, { normalized: string; canonical_product_name: string | null }> = {
      JOG:     { normalized: 'jogurt',      canonical_product_name: null },
      TRUSK:   { normalized: 'truskawkowy', canonical_product_name: null },
      MLEKO:   { normalized: 'mleko',       canonical_product_name: null },
      ZIEMN:   { normalized: 'ziemniaki',   canonical_product_name: null },
      MOZ:     { normalized: 'mozzarella',  canonical_product_name: null },
      CHIPS:   { normalized: 'chipsy',      canonical_product_name: null },
      MASLO:   { normalized: 'masło',       canonical_product_name: null },
      MARCHEW: { normalized: 'marchew',     canonical_product_name: null },
      KURCZAK: { normalized: 'kurczak',     canonical_product_name: null },
      CHLEB:   { normalized: 'chleb',       canonical_product_name: null },
      BULKA:   { normalized: 'bułka',       canonical_product_name: null },
    }
    const match = DICT[raw.toUpperCase()]
    if (!match) return null
    return { ...match, confidence: 0.9, source: 'global' as const }
  }),
}))

import { normalizeReceiptItem } from '@/lib/normalization/normalize'

const USER_ID = 'test-user'

describe('normalizeReceiptItem', () => {
  it('expands JOG to jogurt', async () => {
    const result = await normalizeReceiptItem('JOG', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('jogurt')
    expect(result.needs_review).toBe(false)
    expect(result.source).toBe('dictionary')
  })

  it('expands MLEKO to mleko', async () => {
    const result = await normalizeReceiptItem('MLEKO', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('mleko')
  })

  it('expands ZIEMN to ziemniaki', async () => {
    const result = await normalizeReceiptItem('ZIEMN', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('ziemniaki')
  })

  it('expands MOZ to mozzarella', async () => {
    const result = await normalizeReceiptItem('MOZ', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('mozzarella')
  })

  it('expands CHIPS to chipsy', async () => {
    const result = await normalizeReceiptItem('CHIPS', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('chipsy')
  })

  it('expands MASLO to masło', async () => {
    const result = await normalizeReceiptItem('MASLO', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('masło')
  })

  it('token-expands JOG TRUSK into jogurt truskawkowy', async () => {
    const result = await normalizeReceiptItem('JOG TRUSK', USER_ID, 'Biedronka')
    expect(result.normalizedName).toBe('jogurt truskawkowy')
  })

  it('sets needs_review=true for unknown items', async () => {
    const result = await normalizeReceiptItem('XYZABC123', USER_ID)
    expect(result.needs_review).toBe(true)
  })

  it('preserves rawName', async () => {
    const result = await normalizeReceiptItem('JOG TRUSK', USER_ID)
    expect(result.rawName).toBe('JOG TRUSK')
  })

  it('produces a fingerprint', async () => {
    const result = await normalizeReceiptItem('MLEKO', USER_ID)
    expect(result.fingerprint).toHaveLength(16)
    expect(typeof result.fingerprint).toBe('string')
  })

  it('extracts size attributes', async () => {
    const result = await normalizeReceiptItem('MLEKO 1L', USER_ID)
    expect(result.attributes.size_value).toBe(1)
    expect(result.attributes.size_unit).toBe('l')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Re-import the module fresh each test to avoid shared cache/throttle state
let OpenFoodFactsProvider: typeof import('@/lib/enrichment/openFoodFacts').OpenFoodFactsProvider

beforeEach(async () => {
  vi.resetAllMocks()
  vi.resetModules()
  // Re-import after resetting modules so the module-level cache and
  // lastRequestAt are reset for each test
  const mod = await import('@/lib/enrichment/openFoodFacts')
  OpenFoodFactsProvider = mod.OpenFoodFactsProvider
  vi.stubGlobal('fetch', mockFetch)
})

function makeOFFResponse(product: object | null, status = 1) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status, product }),
  } as Response)
}

function makeSearchResponse(products: object[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ products }),
  } as Response)
}

describe('OpenFoodFactsProvider.lookup', () => {
  it('returns enrichment result for valid barcode', async () => {
    mockFetch.mockReturnValueOnce(
      makeOFFResponse({
        product_name: 'Mleko UHT',
        brands: 'Łaciate',
        quantity: '1L',
        code: '5901234567890',
        categories_tags: ['en:milks'],
      }),
    )

    const provider = new OpenFoodFactsProvider()
    const result = await provider.lookup({ barcode: '5901234567890' })

    expect(result).not.toBeNull()
    expect(result?.canonical_product_name).toBe('Mleko UHT')
    expect(result?.brand).toBe('Łaciate')
    expect(result?.gtin).toBe('5901234567890')
    expect(result?.source).toBe('openfoodfacts')
    expect(result?.confidence).toBe(0.85)
  })

  it('returns null when OFF product not found', async () => {
    mockFetch.mockReturnValueOnce(makeOFFResponse(null, 0))

    const provider = new OpenFoodFactsProvider()
    const result = await provider.lookup({ barcode: '0000000000000' })
    expect(result).toBeNull()
  })

  it('returns null when fetch fails (fail open)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const provider = new OpenFoodFactsProvider()
    // Use a barcode that hasn't been cached in this test's fresh module instance
    const result = await provider.lookup({ barcode: '9990000000001' })
    expect(result).toBeNull()
  })

  it('uses lower confidence for name search', async () => {
    mockFetch.mockReturnValueOnce(
      makeSearchResponse([{
        product_name: 'Jogurt truskawkowy',
        brands: 'Piątnica',
        code: '1234',
        categories_tags: [],
      }]),
    )

    const provider = new OpenFoodFactsProvider()
    const result = await provider.lookup({ name: 'jogurt truskawkowy' })
    expect(result?.confidence).toBe(0.6)
  })

  it('caches barcode results (second call does not fetch)', async () => {
    mockFetch.mockReturnValueOnce(
      makeOFFResponse({ product_name: 'Test', code: '111', categories_tags: [] }),
    )

    const provider = new OpenFoodFactsProvider()
    await provider.lookup({ barcode: '111' })
    await provider.lookup({ barcode: '111' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

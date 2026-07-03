import { describe, it, expect } from 'vitest'
import { shapeReceiptsWithItems } from '../../lib/supabase/queries/receiptItems'

function makeRow(merchant: string, date: string, itemCount: number) {
  return {
    merchant,
    date,
    amount: '10.00',
    receipt_items: Array.from({ length: itemCount }, (_, i) => ({
      name: `RAW ${merchant} ${i}`,
      canonical_product_name: i % 2 === 0 ? `Canonical ${merchant} ${i}` : null,
      normalized_name: null,
      quantity: 1,
      total_price: 2.5,
      category: i % 2 === 0 ? { name: 'Groceries' } : null,
    })),
  }
}

describe('shapeReceiptsWithItems', () => {
  it('shapes rows with display-name fallback and category unwrap', () => {
    const out = shapeReceiptsWithItems([makeRow('Biedronka', '2026-07-02', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].merchant).toBe('Biedronka')
    expect(out[0].items[0]).toEqual({
      name: 'Canonical Biedronka 0', quantity: 1, total_price: 2.5, category: 'Groceries',
    })
    expect(out[0].items[1].name).toBe('RAW Biedronka 1')
    expect(out[0].items[1].category).toBeNull()
  })

  it('caps total items at maxItems by dropping oldest receipts (rows are newest-first)', () => {
    const rows = [makeRow('A', '2026-07-03', 3), makeRow('B', '2026-07-02', 3), makeRow('C', '2026-07-01', 3)]
    const out = shapeReceiptsWithItems(rows, 5)
    expect(out.map((r) => r.merchant)).toEqual(['A'])
  })

  it('handles category returned as array (PostgREST shape)', () => {
    const row = makeRow('X', '2026-07-01', 1)
    ;(row.receipt_items[0] as { category: unknown }).category = [{ name: 'Dairy' }]
    expect(shapeReceiptsWithItems([row])[0].items[0].category).toBe('Dairy')
  })

  it('returns empty array for no rows', () => {
    expect(shapeReceiptsWithItems([])).toEqual([])
  })
})

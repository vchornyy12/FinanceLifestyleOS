import { describe, it, expect } from 'vitest'
import { aggregateByCategory } from '../../lib/supabase/queries/categoryBreakdown'

describe('aggregateByCategory', () => {
  it('sums per category, buckets null as Other, sorts desc', () => {
    const rows = [
      { amount: '10.00', category: { id: 'c1', name: 'Groceries', color: '#0f0' } },
      { amount: '5.50', category: { id: 'c1', name: 'Groceries', color: '#0f0' } },
      { amount: '99.99', category: null },
      { amount: '20.00', category: { id: 'c2', name: 'Transport', color: '#00f' } },
    ]
    const out = aggregateByCategory(rows)
    expect(out).toEqual([
      { categoryId: null, name: 'Other', color: null, total: 99.99 },
      { categoryId: 'c2', name: 'Transport', color: '#00f', total: 20 },
      { categoryId: 'c1', name: 'Groceries', color: '#0f0', total: 15.5 },
    ])
  })
})

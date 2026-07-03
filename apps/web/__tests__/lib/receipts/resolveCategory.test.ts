import { describe, it, expect } from 'vitest'
import { resolveCategoryId } from '../../../lib/receipts/resolveCategory'

const cats = [
  { id: 'c1', name: 'Groceries' },
  { id: 'c2', name: 'Household' },
]

describe('resolveCategoryId', () => {
  it('prefers a history category id when it exists', () => {
    expect(resolveCategoryId({ history_category_id: 'c2', category: 'Groceries' }, cats)).toBe('c2')
  })

  it('ignores a history id that no longer exists and falls back to name match', () => {
    expect(resolveCategoryId({ history_category_id: 'gone', category: 'groceries' }, cats)).toBe('c1')
  })

  it('matches when the AI category contains the category name', () => {
    expect(resolveCategoryId({ category: 'Household chemicals' }, cats)).toBe('c2')
  })

  it('returns null when nothing matches', () => {
    expect(resolveCategoryId({ category: 'Electronics' }, cats)).toBeNull()
    expect(resolveCategoryId({}, cats)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { CategorySchema } from '@/lib/schemas/category'

const VALID_UUID = '00000000-0000-4000-8000-000000000000'
const valid = { name: 'Salary', color: '#10B981', type: 'income' as const }

describe('CategorySchema', () => {
  it('accepts a valid expense category', () => {
    expect(CategorySchema.safeParse({ ...valid, type: 'expense' }).success).toBe(true)
  })

  it('accepts a valid income category', () => {
    expect(CategorySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a valid any category', () => {
    expect(CategorySchema.safeParse({ ...valid, type: 'any' }).success).toBe(true)
  })

  it('accepts a category with a valid parent_id UUID', () => {
    expect(
      CategorySchema.safeParse({ ...valid, parent_id: VALID_UUID }).success
    ).toBe(true)
  })

  it('accepts a category with parent_id: null', () => {
    expect(
      CategorySchema.safeParse({ ...valid, parent_id: null }).success
    ).toBe(true)
  })

  it('rejects a category with a non-UUID parent_id', () => {
    const result = CategorySchema.safeParse({ ...valid, parent_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.parent_id).toBeTruthy()
    }
  })

  it('rejects an invalid type', () => {
    const result = CategorySchema.safeParse({ ...valid, type: 'transfer' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.type).toBeTruthy()
    }
  })

  it('rejects missing type', () => {
    const { type: _, ...noType } = valid
    expect(CategorySchema.safeParse(noType).success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CategorySchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeTruthy()
    }
  })

  it('rejects malformed color', () => {
    const result = CategorySchema.safeParse({ ...valid, color: 'red' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.color).toBeTruthy()
    }
  })
})

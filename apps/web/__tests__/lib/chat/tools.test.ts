import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ReceiptQueryArgsSchema,
  executeReceiptQuery,
  assembleToolCallDeltas,
} from '@/lib/chat/tools'

describe('ReceiptQueryArgsSchema', () => {
  it('accepts valid args and defaults limit to 100', () => {
    const parsed = ReceiptQueryArgsSchema.parse({ start_date: '2026-03-01', end_date: '2026-03-31' })
    expect(parsed).toEqual({ start_date: '2026-03-01', end_date: '2026-03-31', limit: 100 })
  })

  it('rejects malformed dates and out-of-range limits', () => {
    expect(ReceiptQueryArgsSchema.safeParse({ start_date: 'March', end_date: '2026-03-31' }).success).toBe(false)
    expect(ReceiptQueryArgsSchema.safeParse({ start_date: '2026-03-01', end_date: '2026-03-31', limit: 500 }).success).toBe(false)
  })
})

describe('executeReceiptQuery', () => {
  const mockResult = vi.fn()
  function makeSupabase() {
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'gte', 'lte', 'or', 'order', 'limit']) {
      chain[m] = vi.fn(() => chain)
    }
    ;(chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(mockResult())
    return { from: vi.fn(() => chain) } as never
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.mockReturnValue({
      data: [
        {
          name: 'RAW CHLEB', canonical_product_name: 'Chleb zwykły', normalized_name: null,
          quantity: 1, total_price: 3.49,
          category: { name: 'Groceries' },
          transaction: { date: '2026-03-05', merchant: 'Biedronka' },
        },
      ],
      error: null,
    })
  })

  it('returns shaped items JSON for valid args', async () => {
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31' }))
    expect(out.items).toEqual([
      { date: '2026-03-05', merchant: 'Biedronka', name: 'Chleb zwykły', quantity: 1, total_price: 3.49, category: 'Groceries' },
    ])
    expect(out.truncated).toBe(false)
  })

  it('flags truncation when more rows than limit come back', async () => {
    mockResult.mockReturnValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        name: `P${i}`, canonical_product_name: null, normalized_name: null,
        quantity: 1, total_price: 1,
        category: null,
        transaction: { date: '2026-03-05', merchant: 'X' },
      })),
      error: null,
    })
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31', limit: 2 }))
    expect(out.items).toHaveLength(2)
    expect(out.truncated).toBe(true)
  })

  it('returns error JSON for invalid args without throwing', async () => {
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: 'nope' }))
    expect(out.error).toBeTruthy()
  })

  it('returns error JSON when the query fails', async () => {
    mockResult.mockReturnValue({ data: null, error: { message: 'boom' } })
    const out = JSON.parse(await executeReceiptQuery(makeSupabase(), { start_date: '2026-03-01', end_date: '2026-03-31' }))
    expect(out.error).toContain('boom')
  })
})

describe('assembleToolCallDeltas', () => {
  it('assembles a call whose name and arguments arrive in fragments', () => {
    const rounds = [
      [{ index: 0, id: 'call_1', function: { name: 'query_receipt_items', arguments: '{"start' } }],
      [{ index: 0, function: { arguments: '_date":"2026-03-01"}' } }],
    ]
    expect(assembleToolCallDeltas(rounds)).toEqual([
      { id: 'call_1', name: 'query_receipt_items', arguments: '{"start_date":"2026-03-01"}' },
    ])
  })

  it('keeps parallel calls separate by index', () => {
    const rounds = [[
      { index: 0, id: 'a', function: { name: 'query_receipt_items', arguments: '{}' } },
      { index: 1, id: 'b', function: { name: 'query_receipt_items', arguments: '{"limit":5}' } },
    ]]
    const out = assembleToolCallDeltas(rounds)
    expect(out.map((c) => c.id)).toEqual(['a', 'b'])
  })
})

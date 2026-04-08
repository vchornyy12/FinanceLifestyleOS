import { z } from 'zod'
import { ReviewItem, ParsedReceipt } from '@/types/receipt'

const OcrItemSchema = z.object({
  name: z.string(),
  quantity: z.number().default(1),
  unit_price: z.number(),
  total_price: z.number(),
  category: z.string(),
  confidence: z.enum(['high', 'low']),
})

export const OcrReceiptSchema = z.object({
  store: z.string(),
  date: z.string(),
  items: z.array(OcrItemSchema),
  total: z.number(),
  confidence: z.enum(['high', 'low']),
  discrepancy_warning: z.boolean().optional(),
})

/**
 * Parse an unknown value against the OCR receipt schema.
 * Assigns a stable crypto UUID to each item so ReviewItem.id is always set.
 */
export function parseOcrReceipt(raw: unknown): ParsedReceipt | null {
  const result = OcrReceiptSchema.safeParse(raw)
  if (!result.success) return null
  const { items, ...rest } = result.data
  const reviewItems: ReviewItem[] = items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
  }))
  return { ...rest, items: reviewItems }
}

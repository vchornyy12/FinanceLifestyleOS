import { z } from 'zod'

export const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().default(1),
  unit_price: z.number(),
  total_price: z.number(),
  category: z.string(),
  confidence: z.enum(['high', 'low']),
})

export const ParsedReceiptSchema = z.object({
  store: z.string(),
  date: z.string(),
  items: z.array(ReceiptItemSchema),
  total: z.number(),
  confidence: z.enum(['high', 'low']),
  discrepancy_warning: z.boolean().optional(),
})

export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>

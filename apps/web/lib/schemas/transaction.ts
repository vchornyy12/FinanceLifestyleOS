import { z } from 'zod'

export const TransactionTypeEnum = z.enum(['expense', 'income', 'transfer'])
export type TransactionTypeInput = z.infer<typeof TransactionTypeEnum>

const baseShape = {
  type: TransactionTypeEnum,
  merchant: z.string().trim().min(1, 'Required').max(200),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
  category_id: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note: z.string().max(500).optional(),
  wallet_id: z.string().uuid().nullable().optional(),
  from_wallet_id: z.string().uuid().nullable().optional(),
  to_wallet_id: z.string().uuid().nullable().optional(),
}

export const TransactionSchema = z.object(baseShape).superRefine((data, ctx) => {
  if (data.type === 'transfer') {
    if (!data.from_wallet_id) {
      ctx.addIssue({ code: 'custom', path: ['from_wallet_id'], message: 'Required for transfer' })
    }
    if (!data.to_wallet_id) {
      ctx.addIssue({ code: 'custom', path: ['to_wallet_id'], message: 'Required for transfer' })
    }
    if (data.from_wallet_id && data.to_wallet_id && data.from_wallet_id === data.to_wallet_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_wallet_id'],
        message: 'Must differ from source wallet',
      })
    }
  }
})

export type TransactionInput = z.infer<typeof TransactionSchema>

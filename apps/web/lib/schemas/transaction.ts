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
  from_account: z.string().trim().min(1).max(100).nullable().optional(),
  to_account: z.string().trim().min(1).max(100).nullable().optional(),
}

export const TransactionSchema = z.object(baseShape).superRefine((data, ctx) => {
  if (data.type === 'transfer') {
    if (!data.from_account) {
      ctx.addIssue({
        code: 'custom',
        path: ['from_account'],
        message: 'Required for transfers',
      })
    }
    if (!data.to_account) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_account'],
        message: 'Required for transfers',
      })
    }
    if (
      data.from_account &&
      data.to_account &&
      data.from_account.trim().toLowerCase() === data.to_account.trim().toLowerCase()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_account'],
        message: 'From and to accounts must differ',
      })
    }
  } else {
    if (data.from_account) {
      ctx.addIssue({
        code: 'custom',
        path: ['from_account'],
        message: 'Only allowed on transfers',
      })
    }
    if (data.to_account) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_account'],
        message: 'Only allowed on transfers',
      })
    }
  }
})

export type TransactionInput = z.infer<typeof TransactionSchema>

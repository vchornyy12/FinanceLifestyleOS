import { z } from 'zod'

export const WalletSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(['cash', 'debit', 'credit_card', 'savings', 'investment', 'crypto']),
  currency: z.string().trim().min(3).max(3).default('PLN'),
  opening_balance: z.coerce.number().default(0),
  credit_limit: z.coerce.number().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'credit_card' && !data.credit_limit) {
    ctx.addIssue({ code: 'custom', path: ['credit_limit'], message: 'Required for credit card' })
  }
  if (data.type !== 'credit_card' && data.credit_limit != null) {
    ctx.addIssue({ code: 'custom', path: ['credit_limit'], message: 'Only for credit card' })
  }
})

export type WalletFormData = z.infer<typeof WalletSchema>

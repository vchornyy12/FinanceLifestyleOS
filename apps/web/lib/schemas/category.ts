import { z } from 'zod'

export const CategoryTypeEnum = z.enum(['expense', 'income', 'any'])
export type CategoryTypeInput = z.infer<typeof CategoryTypeEnum>

export const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
  type: CategoryTypeEnum,
})

export type CategoryInput = z.infer<typeof CategorySchema>

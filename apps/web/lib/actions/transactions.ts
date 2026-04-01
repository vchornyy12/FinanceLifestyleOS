'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const TransactionSchema = z.object({
  merchant: z.string().min(1, 'Merchant is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  category_id: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  note: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type TransactionActionState = {
  fieldErrors?: {
    merchant?: string[]
    amount?: string[]
    category_id?: string[]
    date?: string[]
    note?: string[]
  }
  error?: string
  success?: boolean
} | null

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

/**
 * Insert a new transaction for the currently authenticated user.
 * user_id comes exclusively from the server-side session — never from formData.
 */
export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const raw = {
    merchant: formData.get('merchant'),
    amount: formData.get('amount'),
    category_id: formData.get('category_id') || null,
    date: formData.get('date'),
    note: formData.get('note') ?? undefined,
  }

  const parsed = TransactionSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  // Verify authentication — never trust client-supplied user_id
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { merchant, amount, category_id, date, note } = parsed.data

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    merchant,
    amount,
    category_id: category_id ?? null,
    date,
    note: note ?? null,
  })

  if (error) {
    return { error: `Failed to create transaction: ${error.message}` }
  }

  revalidatePath('/dashboard/transactions')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

/**
 * Update an existing transaction by id.
 * RLS enforces ownership — no manual user_id filter required.
 */
export async function updateTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const id = formData.get('id') as string | null
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: 'Invalid transaction ID.' }
  }

  const raw = {
    merchant: formData.get('merchant'),
    amount: formData.get('amount'),
    category_id: formData.get('category_id') || null,
    date: formData.get('date'),
    note: formData.get('note') ?? undefined,
  }

  const parsed = TransactionSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { merchant, amount, category_id, date, note } = parsed.data

  const { error } = await supabase
    .from('transactions')
    .update({
      merchant,
      amount,
      category_id: category_id ?? null,
      date,
      note: note ?? null,
    })
    .eq('id', id)

  if (error) {
    return { error: `Failed to update transaction: ${error.message}` }
  }

  revalidatePath('/dashboard/transactions')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

/**
 * Delete a transaction by id.
 * RLS enforces ownership — no manual user_id filter required.
 */
export async function deleteTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const id = formData.get('id') as string | null
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: 'Invalid transaction ID.' }
  }

  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)

  if (error) {
    return { error: `Failed to delete transaction: ${error.message}` }
  }

  revalidatePath('/dashboard/transactions')
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { TransactionSchema } from '@/lib/schemas/transaction'
import type { TransactionType } from '@/types/database'

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type TransactionActionState = {
  fieldErrors?: {
    type?: string[]
    merchant?: string[]
    amount?: string[]
    category_id?: string[]
    date?: string[]
    note?: string[]
    from_account?: string[]
    to_account?: string[]
  }
  error?: string
  success?: boolean
} | null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function extractInput(formData: FormData) {
  const type = (formData.get('type') ?? 'expense') as TransactionType
  const isTransfer = type === 'transfer'

  return {
    type,
    // For transfers we don't ask for a merchant; store a fixed label so the
    // NOT NULL merchant column stays satisfied and the list UI can still
    // render a sensible value if it falls back to `merchant`.
    merchant: isTransfer ? 'Transfer' : ((formData.get('merchant') ?? '') as string),
    amount: (formData.get('amount') ?? '') as string,
    category_id: (formData.get('category_id') || null) as string | null,
    date: (formData.get('date') ?? '') as string,
    note: ((formData.get('note') ?? '') as string) || undefined,
    from_account: isTransfer
      ? (((formData.get('from_account') ?? '') as string) || null)
      : null,
    to_account: isTransfer
      ? (((formData.get('to_account') ?? '') as string) || null)
      : null,
  }
}

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = TransactionSchema.safeParse(extractInput(formData))
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { type, merchant, amount, category_id, date, note, from_account, to_account } =
    parsed.data

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type,
    merchant,
    amount,
    category_id: category_id ?? null,
    date,
    note: note ?? null,
    from_account: from_account ?? null,
    to_account: to_account ?? null,
  })

  if (error) {
    return { error: `Failed to create transaction: ${error.message}` }
  }

  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

export async function updateTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_RE.test(id)) {
    return { error: 'Invalid transaction ID.' }
  }

  const parsed = TransactionSchema.safeParse(extractInput(formData))
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { type, merchant, amount, category_id, date, note, from_account, to_account } =
    parsed.data

  const { data: updated, error } = await supabase
    .from('transactions')
    .update({
      type,
      merchant,
      amount,
      category_id: category_id ?? null,
      date,
      note: note ?? null,
      from_account: from_account ?? null,
      to_account: to_account ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id) // defence-in-depth over RLS
    .select('id')

  if (error) {
    return { error: 'Failed to update transaction.' }
  }
  if (!updated || updated.length === 0) {
    return { error: 'Transaction not found or permission denied.' }
  }

  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

export async function deleteTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_RE.test(id)) {
    return { error: 'Invalid transaction ID.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // defence-in-depth over RLS

  if (error) {
    return { error: 'Failed to delete transaction.' }
  }

  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { TransactionSchema } from '@/lib/schemas/transaction'
import type { TransactionType } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function validateCategoryType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  transactionType: string,
): Promise<string | null> {
  if (transactionType === 'transfer') return null
  const { data } = await supabase
    .from('categories')
    .select('type')
    .eq('id', categoryId)
    .single()
  if (!data) return 'Category not found.'
  if (data.type !== 'any' && data.type !== transactionType) {
    return `This category is for ${data.type} transactions.`
  }
  return null
}

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
    wallet_id?: string[]
    from_wallet_id?: string[]
    to_wallet_id?: string[]
  }
  error?: string
  success?: boolean
} | null

// ---------------------------------------------------------------------------
// Input extraction
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
    wallet_id: isTransfer
      ? null
      : (((formData.get('wallet_id') ?? '') as string) || null),
    from_wallet_id: isTransfer
      ? (((formData.get('from_wallet_id') ?? '') as string) || null)
      : null,
    to_wallet_id: isTransfer
      ? (((formData.get('to_wallet_id') ?? '') as string) || null)
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

  if (parsed.data.category_id) {
    const catErr = await validateCategoryType(supabase, parsed.data.category_id, parsed.data.type)
    if (catErr) return { error: catErr }
  }

  const { type, merchant, amount, category_id, date, note, wallet_id, from_wallet_id, to_wallet_id } =
    parsed.data

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type,
    merchant,
    amount,
    category_id: category_id ?? null,
    date,
    note: note ?? null,
    wallet_id: wallet_id ?? null,
    from_wallet_id: from_wallet_id ?? null,
    to_wallet_id: to_wallet_id ?? null,
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

  if (parsed.data.category_id) {
    const catErr = await validateCategoryType(supabase, parsed.data.category_id, parsed.data.type)
    if (catErr) return { error: catErr }
  }

  const { type, merchant, amount, category_id, date, note, wallet_id, from_wallet_id, to_wallet_id } =
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
      wallet_id: wallet_id ?? null,
      from_wallet_id: from_wallet_id ?? null,
      to_wallet_id: to_wallet_id ?? null,
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

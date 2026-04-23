'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CategorySchema } from '@/lib/schemas/category'

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type CategoryActionState = {
  fieldErrors?: { name?: string[]; color?: string[]; type?: string[] }
  error?: string
  success?: boolean
  requiresReassignment?: boolean
  count?: number
} | null

// ---------------------------------------------------------------------------
// UUID regex for validation
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

/**
 * Insert a new user-defined category.
 * user_id comes exclusively from the server-side session — never from formData.
 */
export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
  }

  const parsed = CategorySchema.safeParse(raw)
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

  const { name, color, type } = parsed.data

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name,
    color,
    type,
  })

  if (error) {
    return { error: `Failed to create category: ${error.message}` }
  }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

/**
 * Update an existing user-defined category by id.
 * RLS enforces ownership (user_id = auth.uid()) — no manual filter required.
 */
export async function updateCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_REGEX.test(id)) {
    return { error: 'Invalid category ID.' }
  }

  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
  }

  const parsed = CategorySchema.safeParse(raw)
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

  const { name, color, type } = parsed.data

  // Explicit user_id filter as defence-in-depth over RLS.
  const { data: updated, error } = await supabase
    .from('categories')
    .update({ name, color, type })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) {
    return { error: 'Failed to update category.' }
  }
  if (!updated || updated.length === 0) {
    return { error: 'Category not found or permission denied.' }
  }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

/**
 * Delete a user-defined category by id.
 *
 * Flow:
 *  1. Verify authentication.
 *  2. Count transactions referencing this category.
 *  3. If count > 0 and no reassignToId provided → return { requiresReassignment: true, count }.
 *  4. If count > 0 and reassignToId provided → reassign those transactions first.
 *  5. Delete the category (RLS enforces ownership).
 */
export async function deleteCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_REGEX.test(id)) {
    return { error: 'Invalid category ID.' }
  }

  const reassignToId = formData.get('reassignToId') as string | null

  // Validate reassignToId if provided
  if (reassignToId && !UUID_REGEX.test(reassignToId)) {
    return { error: 'Invalid reassign target ID.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated.' }
  }

  // Count transactions using this category
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (countError) {
    return { error: `Failed to check transactions: ${countError.message}` }
  }

  const txCount = count ?? 0

  // If in use and no reassignment target provided, ask the caller to reassign
  if (txCount > 0 && !reassignToId) {
    return { requiresReassignment: true, count: txCount }
  }

  // If in use and reassignment target provided, verify target ownership then reassign
  if (txCount > 0 && reassignToId) {
    // Verify reassignToId is a category the user may use (own or system default)
    const { count: targetCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('id', reassignToId)
    if (!targetCount) {
      return { error: 'Reassignment target category not found.' }
    }

    const { error: reassignError } = await supabase
      .from('transactions')
      .update({ category_id: reassignToId })
      .eq('category_id', id)
      .eq('user_id', user.id) // scope to current user's transactions only

    if (reassignError) {
      return { error: 'Failed to reassign transactions.' }
    }
  }

  // Delete the category (RLS enforces user_id = auth.uid())
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // explicit ownership filter

  if (deleteError) {
    return { error: `Failed to delete category: ${deleteError.message}` }
  }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
})

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type CategoryActionState = {
  fieldErrors?: { name?: string[]; color?: string[] }
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

  const { name, color } = parsed.data

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name,
    color,
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

  const { name, color } = parsed.data

  const { error } = await supabase
    .from('categories')
    .update({ name, color })
    .eq('id', id)

  if (error) {
    return { error: `Failed to update category: ${error.message}` }
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

  // If in use and reassignment target provided, reassign transactions first
  if (txCount > 0 && reassignToId) {
    const { error: reassignError } = await supabase
      .from('transactions')
      .update({ category_id: reassignToId })
      .eq('category_id', id)

    if (reassignError) {
      return { error: `Failed to reassign transactions: ${reassignError.message}` }
    }
  }

  // Delete the category (RLS enforces user_id = auth.uid())
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return { error: `Failed to delete category: ${deleteError.message}` }
  }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

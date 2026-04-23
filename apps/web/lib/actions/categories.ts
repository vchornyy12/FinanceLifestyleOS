'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CategorySchema } from '@/lib/schemas/category'

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

export type CategoryActionState = {
  fieldErrors?: { name?: string[]; color?: string[]; type?: string[]; parent_id?: string[] }
  error?: string
  success?: boolean
  requiresReassignment?: boolean
  count?: number
  subcategoryCount?: number
} | null

// ---------------------------------------------------------------------------
// UUID regex
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
  const parentIdRaw = formData.get('parent_id') as string | null
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
    parent_id: parentIdRaw || null,
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  const { name, color, type, parent_id } = parsed.data

  // Nesting guard: parent must itself be a top-level category
  if (parent_id) {
    const { data: parent } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', parent_id)
      .eq('user_id', user.id)
      .single()
    if (!parent) return { error: 'Parent category not found.' }
    if (parent.parent_id !== null) return { error: 'Cannot nest deeper than one level.' }
  }

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name,
    color,
    type,
    parent_id: parent_id ?? null,
  })

  if (error) return { error: `Failed to create category: ${error.message}` }

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
  if (!id || !UUID_REGEX.test(id)) return { error: 'Invalid category ID.' }

  const parentIdRaw = formData.get('parent_id') as string | null
  const raw = {
    name: formData.get('name'),
    color: formData.get('color'),
    type: formData.get('type'),
    parent_id: parentIdRaw || null,
  }

  const parsed = CategorySchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  const { name, color, type, parent_id } = parsed.data

  // Nesting guard
  if (parent_id) {
    if (parent_id === id) return { error: 'A category cannot be its own parent.' }
    const { data: parent } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', parent_id)
      .eq('user_id', user.id)
      .single()
    if (!parent) return { error: 'Parent category not found.' }
    if (parent.parent_id !== null) return { error: 'Cannot nest deeper than one level.' }
  }

  const { data: updated, error } = await supabase
    .from('categories')
    .update({ name, color, type, parent_id: parent_id ?? null })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (error) return { error: 'Failed to update category.' }
  if (!updated || updated.length === 0) return { error: 'Category not found or permission denied.' }

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
 *  2. Collect subcategory IDs (children).
 *  3. Count transactions on this category and its children.
 *  4. If count > 0 and no reassignToId → return { requiresReassignment: true, count, subcategoryCount }.
 *  5. If count > 0 and reassignToId → reassign all those transactions first.
 *  6. Delete the category (CASCADE removes subcategories at DB level).
 */
export async function deleteCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = formData.get('id') as string | null
  if (!id || !UUID_REGEX.test(id)) return { error: 'Invalid category ID.' }

  const reassignToId = formData.get('reassignToId') as string | null
  if (reassignToId && !UUID_REGEX.test(reassignToId)) return { error: 'Invalid reassign target ID.' }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated.' }

  // Get subcategory IDs (children of this category)
  const { data: subs } = await supabase
    .from('categories')
    .select('id')
    .eq('parent_id', id)
    .eq('user_id', user.id)
  const subIds = (subs ?? []).map((s) => s.id)

  // Count transactions on this category
  const { count: directCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('user_id', user.id)

  // Count transactions on its subcategories
  let subTxCount = 0
  if (subIds.length > 0) {
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('category_id', subIds)
      .eq('user_id', user.id)
    subTxCount = count ?? 0
  }

  const totalTxCount = (directCount ?? 0) + subTxCount

  if (totalTxCount > 0 && !reassignToId) {
    return {
      requiresReassignment: true,
      count: totalTxCount,
      subcategoryCount: subIds.length,
    }
  }

  if (totalTxCount > 0 && reassignToId) {
    // Verify target category belongs to this user
    const { count: targetCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('id', reassignToId)
      .eq('user_id', user.id)
    if (!targetCount) return { error: 'Reassignment target category not found.' }

    // Reassign direct transactions
    const { error: reassignDirect } = await supabase
      .from('transactions')
      .update({ category_id: reassignToId })
      .eq('category_id', id)
      .eq('user_id', user.id)
    if (reassignDirect) return { error: 'Failed to reassign transactions.' }

    // Reassign subcategory transactions
    if (subIds.length > 0) {
      const { error: reassignSubs } = await supabase
        .from('transactions')
        .update({ category_id: reassignToId })
        .in('category_id', subIds)
        .eq('user_id', user.id)
      if (reassignSubs) return { error: 'Failed to reassign subcategory transactions.' }
    }
  }

  // Delete the category — CASCADE removes subcategories at DB level
  const { error: deleteError } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) return { error: `Failed to delete category: ${deleteError.message}` }

  revalidatePath('/dashboard/settings/categories')
  return { success: true }
}

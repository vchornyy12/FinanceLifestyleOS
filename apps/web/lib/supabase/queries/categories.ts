import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/types/database'

export type CategoryWithChildren = Category & { children: Category[] }

/**
 * Fetch all categories for the current user and return them as a tree.
 * Parents (parent_id = null) are sorted alphabetically; children sorted
 * alphabetically within their parent.
 *
 * RLS ensures only the current user's rows are returned.
 */
export async function getUserCategoryTree(): Promise<CategoryWithChildren[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`)
  }

  const rows = (data ?? []) as Category[]
  const childrenMap = new Map<string, Category[]>()

  for (const row of rows) {
    if (row.parent_id) {
      const existing = childrenMap.get(row.parent_id) ?? []
      childrenMap.set(row.parent_id, [...existing, row])
    }
  }

  return rows
    .filter((r) => r.parent_id === null)
    .map((parent) => ({
      ...parent,
      children: childrenMap.get(parent.id) ?? [],
    }))
}

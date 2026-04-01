import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/types/database'
import CategoryList from '@/components/categories/CategoryList'

export const metadata = {
  title: 'Categories | Finance Lifestyle OS',
}

export default async function CategoriesPage() {
  const supabase = await createClient()

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // RLS returns system defaults (user_id IS NULL) + user's own categories
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`)
  }

  const categories: Category[] = data ?? []

  const systemCategories = categories.filter((c) => c.user_id === null)
  const userCategories = categories.filter((c) => c.user_id !== null)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Categories</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage transaction categories. System defaults are read-only.
        </p>
      </div>

      {/* Category list */}
      <CategoryList
        systemCategories={systemCategories}
        userCategories={userCategories}
      />
    </div>
  )
}

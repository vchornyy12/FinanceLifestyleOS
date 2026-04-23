import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserCategoryTree } from '@/lib/supabase/queries/categories'
import CategoryList from '@/components/categories/CategoryList'

export const metadata = {
  title: 'Categories | Finance Lifestyle OS',
}

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tree = await getUserCategoryTree()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Categories</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your categories. Click a category to expand its subcategories.
        </p>
      </div>

      <CategoryList tree={tree} />
    </div>
  )
}

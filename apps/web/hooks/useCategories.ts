'use client'

import { useState, useEffect } from 'react'
import type { Category } from '@/types/database'

/**
 * Client hook that holds category state.
 *
 * Categories change rarely so no Realtime subscription is needed.
 * The hook syncs whenever `initialData` changes (e.g. after a server
 * revalidation triggers a parent server component re-render).
 */
export function useCategories(initialData: Category[]): Category[] {
  const [categories, setCategories] = useState<Category[]>(initialData)

  useEffect(() => {
    setCategories(initialData)
  }, [initialData])

  return categories
}

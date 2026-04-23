import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/database'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, color, type, user_id, created_at')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('useCategories fetch error:', error)
        if (data) setCategories(data as Category[])
        setLoading(false)
      })
  }, [])

  return { categories, loading }
}

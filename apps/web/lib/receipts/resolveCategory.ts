/**
 * Pick a category id for a parsed receipt item without user input.
 * Priority: category-learning history match → fuzzy match of the AI's
 * category label against the user's categories → null (uncategorized).
 */
export function resolveCategoryId(
  item: { history_category_id?: string | null; category?: string },
  categories: Array<{ id: string; name: string }>,
): string | null {
  if (item.history_category_id && categories.some((c) => c.id === item.history_category_id)) {
    return item.history_category_id
  }
  const label = item.category?.toLowerCase().trim()
  if (!label) return null
  const match = categories.find((c) => {
    const name = c.name.toLowerCase()
    return name.includes(label) || label.includes(name)
  })
  return match?.id ?? null
}

/**
 * Mobile-side mirror of transaction-related types.
 *
 * Kept in sync with apps/web/types/database.ts. Until packages/shared is
 * extracted, both copies must be edited together when the schema changes.
 */

export type TransactionSource = 'manual' | 'bank_sync' | 'ocr'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CategoryType = 'expense' | 'income' | 'any'

export interface TransactionRow {
  id: string
  user_id: string
  amount: string
  merchant: string
  category_id: string | null
  date: string
  note: string | null
  source: TransactionSource
  type: TransactionType
  from_account: string | null
  to_account: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export interface CategoryRow {
  id: string
  user_id: string | null
  name: string
  color: string
  type: CategoryType
  parent_id: string | null
  created_at: string
}

export type Transaction = TransactionRow
export type Category = CategoryRow

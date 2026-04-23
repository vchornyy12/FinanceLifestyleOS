/**
 * Supabase database type definitions.
 *
 * Mirrors the schema defined in:
 *   supabase/migrations/001_initial_schema.sql
 *   supabase/migrations/002_rls_policies.sql
 *   supabase/migrations/003_receipt_storage.sql
 *   supabase/migrations/004_transaction_type.sql
 *   supabase/migrations/005_category_type.sql
 *   supabase/migrations/006_category_tree.sql
 *
 * Pattern: Database["public"]["Tables"][TableName]["Row" | "Insert" | "Update"]
 */

export type TransactionSource = 'manual' | 'bank_sync' | 'ocr'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CategoryType = 'expense' | 'income' | 'any'

// ---------------------------------------------------------------------------
// Table row shapes
// ---------------------------------------------------------------------------

export interface ProfileRow {
  id: string
  full_name: string | null
  avatar_url: string | null
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

// ---------------------------------------------------------------------------
// Insert shapes (required fields only; generated fields optional)
// ---------------------------------------------------------------------------

export interface ProfileInsert {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  created_at?: string
  updated_at?: string
}

export interface CategoryInsert {
  id?: string
  user_id?: string | null
  name: string
  color: string
  type: CategoryType
  parent_id?: string | null
  created_at?: string
}

export interface TransactionInsert {
  id?: string
  user_id: string
  amount: string
  merchant: string
  category_id?: string | null
  date: string
  note?: string | null
  source?: TransactionSource
  type: TransactionType
  from_account?: string | null
  to_account?: string | null
  receipt_url?: string | null
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Update shapes (all fields optional except identity columns)
// ---------------------------------------------------------------------------

export type ProfileUpdate = Partial<Omit<ProfileRow, 'id' | 'created_at'>>

export type CategoryUpdate = Partial<Omit<CategoryRow, 'id' | 'user_id' | 'created_at'>>

export type TransactionUpdate = Partial<Omit<TransactionRow, 'id' | 'user_id' | 'created_at'>>

// ---------------------------------------------------------------------------
// Database interface (Supabase-style generated types pattern)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      categories: {
        Row: CategoryRow
        Insert: CategoryInsert
        Update: CategoryUpdate
      }
      transactions: {
        Row: TransactionRow
        Insert: TransactionInsert
        Update: TransactionUpdate
      }
    }
    Enums: {
      transaction_source: TransactionSource
      transaction_type: TransactionType
      category_type: CategoryType
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience type aliases
// ---------------------------------------------------------------------------

export type Profile = ProfileRow
export type Category = CategoryRow
export type Transaction = TransactionRow

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
 *
 * NOTE: Row/Insert/Update shapes use `type` (not `interface`) so that TypeScript
 * can infer an implicit index signature and they satisfy Record<string, unknown>
 * as required by @supabase/postgrest-js GenericTable constraint (strict mode).
 */

export type TransactionSource = 'manual' | 'bank_sync' | 'ocr'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type CategoryType = 'expense' | 'income' | 'any'

// ---------------------------------------------------------------------------
// Table row shapes
// ---------------------------------------------------------------------------

export type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  user_id: string | null
  name: string
  color: string
  type: CategoryType
  parent_id: string | null
  created_at: string
}

export type TransactionRow = {
  id: string
  user_id: string
  amount: string
  merchant: string
  category_id: string | null
  date: string
  note: string | null
  source: TransactionSource
  type: TransactionType
  wallet_id: string | null
  from_wallet_id: string | null
  to_wallet_id: string | null
  receipt_url: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Insert shapes (required fields only; generated fields optional)
// ---------------------------------------------------------------------------

export type ProfileInsert = {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  created_at?: string
  updated_at?: string
}

export type CategoryInsert = {
  id?: string
  user_id?: string | null
  name: string
  color: string
  type: CategoryType
  parent_id?: string | null
  created_at?: string
}

export type TransactionInsert = {
  id?: string
  user_id: string
  amount: string
  merchant: string
  category_id?: string | null
  date: string
  note?: string | null
  source?: TransactionSource
  type: TransactionType
  wallet_id?: string | null
  from_wallet_id?: string | null
  to_wallet_id?: string | null
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
// ReceiptParseJob types (migration 015)
// ---------------------------------------------------------------------------

export type OcrJobStatus = 'pending' | 'processing' | 'done' | 'error'

export type ReceiptParseJobRow = {
  id: string
  user_id: string
  storage_path: string
  status: OcrJobStatus
  result: Record<string, unknown> | null
  error_code: string | null
  created_at: string
  updated_at: string
}

export type ReceiptParseJobInsert = {
  id?: string
  user_id: string
  storage_path: string
  status?: OcrJobStatus
  result?: Record<string, unknown> | null
  error_code?: string | null
}

export type ReceiptParseJobUpdate = Partial<Omit<ReceiptParseJobRow, 'id' | 'user_id' | 'created_at'>>

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
        Relationships: []
      }
      categories: {
        Row: CategoryRow
        Insert: CategoryInsert
        Update: CategoryUpdate
        Relationships: []
      }
      transactions: {
        Row: TransactionRow
        Insert: TransactionInsert
        Update: TransactionUpdate
        Relationships: []
      }
      receipt_parse_jobs: {
        Row: ReceiptParseJobRow
        Insert: ReceiptParseJobInsert
        Update: ReceiptParseJobUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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

// ---------------------------------------------------------------------------
// ReceiptItem types (migration 012)
// ---------------------------------------------------------------------------

export type ReceiptItemConfidence = 'high' | 'low'

export type ReceiptItemRow = {
  id: string
  transaction_id: string
  user_id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string | null
  confidence: ReceiptItemConfidence
  created_at: string
}

export type ReceiptItemInsert = {
  id?: string
  transaction_id: string
  user_id: string
  name: string
  quantity?: number
  unit_price: number
  total_price: number
  category_id?: string | null
  confidence?: ReceiptItemConfidence
}

export type ReceiptItemUpdate = Partial<Omit<ReceiptItemRow, 'id' | 'transaction_id' | 'user_id' | 'created_at'>>

// ---------------------------------------------------------------------------
// Wallet types
// ---------------------------------------------------------------------------

export type WalletType = 'cash' | 'debit' | 'credit_card' | 'savings' | 'investment' | 'crypto'

export type WalletRow = {
  id: string
  user_id: string
  name: string
  type: WalletType
  currency: string
  opening_balance: number
  credit_limit: number | null
  created_at: string
  updated_at: string
}

export type WalletInsert = Omit<WalletRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type WalletUpdate = Partial<WalletInsert>

export type WalletWithBalance = WalletRow & {
  balance: number
}

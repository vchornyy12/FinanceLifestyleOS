import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const ReceiptQueryArgsSchema = z.object({
  start_date: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  end_date: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  search: z.string().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(200).default(100),
})

export const receiptQueryTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'query_receipt_items',
    description:
      'Look up individual products the user bought from scanned receipts in a date range. ' +
      'Use this for purchases not listed in the system prompt (older receipts or specific searches).',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Range start, YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Range end (inclusive), YYYY-MM-DD' },
        search: { type: 'string', description: 'Optional case-insensitive product-name filter' },
        limit: { type: 'number', description: 'Max items to return, 1-200 (default 100)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
}

type ReceiptQueryRow = {
  name: string
  canonical_product_name: string | null
  normalized_name: string | null
  quantity: number
  total_price: number
  category: { name: string } | { name: string }[] | null
  transaction: { date: string; merchant: string } | null
}

/**
 * Run the query_receipt_items tool. Always resolves to a JSON string —
 * `{items, truncated}` on success, `{error}` on any failure — so a bad
 * model call can never break the chat stream.
 */
export async function executeReceiptQuery(supabase: SupabaseClient, rawArgs: unknown): Promise<string> {
  const parsed = ReceiptQueryArgsSchema.safeParse(rawArgs)
  if (!parsed.success) {
    return JSON.stringify({ error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join('; ')}` })
  }
  const { start_date, end_date, search, limit } = parsed.data

  try {
    let query = supabase
      .from('receipt_items')
      .select(
        'name, canonical_product_name, normalized_name, quantity, total_price, category:categories(name), transaction:transactions!transaction_id!inner(date, merchant)',
      )
      .eq('transaction.source', 'ocr')
      .gte('transaction.date', start_date)
      .lte('transaction.date', end_date)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (search) {
      const term = search.replace(/[%_,()]/g, ' ').trim()
      if (term) {
        query = query.or(`name.ilike.%${term}%,normalized_name.ilike.%${term}%,canonical_product_name.ilike.%${term}%`)
      }
    }

    const { data, error } = await query
    if (error) {
      return JSON.stringify({ error: `Query failed: ${error.message}` })
    }

    const rows = (data ?? []) as unknown as ReceiptQueryRow[]
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map((row) => ({
      date: row.transaction?.date ?? null,
      merchant: row.transaction?.merchant ?? null,
      name: row.canonical_product_name ?? row.normalized_name ?? row.name,
      quantity: row.quantity,
      total_price: Number(row.total_price),
      category: Array.isArray(row.category) ? (row.category[0]?.name ?? null) : (row.category?.name ?? null),
    }))

    return JSON.stringify({ items, truncated })
  } catch (err) {
    return JSON.stringify({ error: `Query failed: ${err instanceof Error ? err.message : 'unknown'}` })
  }
}

export type ToolCallDelta = {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

export interface AssembledToolCall {
  id: string
  name: string
  arguments: string
}

/** Reassemble streamed tool-call fragments (grouped per chunk) into whole calls. */
export function assembleToolCallDeltas(deltas: ToolCallDelta[][]): AssembledToolCall[] {
  const byIndex = new Map<number, AssembledToolCall>()
  for (const chunk of deltas) {
    for (const d of chunk) {
      const existing = byIndex.get(d.index) ?? { id: '', name: '', arguments: '' }
      if (d.id) existing.id = d.id
      if (d.function?.name) existing.name += d.function.name
      if (d.function?.arguments) existing.arguments += d.function.arguments
      byIndex.set(d.index, existing)
    }
  }
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, call]) => call)
}

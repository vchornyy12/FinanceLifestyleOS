'use client'

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SaveReceiptInput } from '@/app/dashboard/receipts/upload/actions'
import type { WalletWithBalance } from '@/types/database'

type Phase = 'idle' | 'processing' | 'review'

interface Category {
  id: string
  name: string
}

// What the parse route actually returns per item (superset of the Zod schema)
interface ParsedItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
  confidence: 'high' | 'low'
  raw_name?: string
  normalized_name?: string | null
  canonical_product_name?: string | null
  brand?: string | null
  size_value?: number | null
  size_unit?: string | null
  flavor?: string | null
  variant?: string | null
  gtin?: string | null
  normalization_confidence?: number | null
  enrichment_confidence?: number | null
  normalization_source?: string | null
  enrichment_source?: string | null
  needs_review?: boolean
  product_fingerprint?: string | null
}

interface ParsedReceiptResponse {
  store: string
  date: string
  total: number
  confidence: 'high' | 'low'
  discrepancy_warning?: boolean
  items: ParsedItem[]
}

// Internal review state per item
interface ReviewItem {
  // display_name: what the user sees and edits (initialized to canonical/normalized/raw)
  display_name: string
  raw_name: string
  quantity: number
  unit_price: number
  total_price: number
  category_id: string
  confidence: 'high' | 'low'
  // Enrichment passthrough
  normalized_name: string | null
  canonical_product_name: string | null
  brand: string | null
  size_value: number | null
  size_unit: string | null
  flavor: string | null
  variant: string | null
  gtin: string | null
  normalization_confidence: number | null
  enrichment_confidence: number | null
  normalization_source: string | null
  enrichment_source: string | null
  needs_review: boolean
  product_fingerprint: string | null
}

interface ReviewState {
  store: string
  date: string
  wallet_id: string
  total: number
  items: ReviewItem[]
  discrepancy_warning?: boolean
}

interface Props {
  wallets: WalletWithBalance[]
  categories: Category[]
  onSave: (input: SaveReceiptInput) => Promise<{ error?: string }>
}

function matchCategory(ocrCategory: string, categories: Category[]): string {
  if (!ocrCategory) return ''
  const lower = ocrCategory.toLowerCase()
  const match = categories.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()),
  )
  return match?.id ?? ''
}

function normConfidenceLabel(
  confidence: number | null | undefined,
  needsReview: boolean,
): { label: string; className: string } | null {
  if (needsReview || (confidence !== null && confidence !== undefined && confidence < 0.7)) {
    return {
      label: 'review',
      className:
        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    }
  }
  if (confidence !== null && confidence !== undefined && confidence < 0.85) {
    return {
      label: 'medium',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    }
  }
  return null
}

const PLN = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

export default function ReceiptUploader({ wallets, categories, onSave }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      const ACCEPTED_MIME = /^(image\/(jpeg|png|webp)|application\/pdf|text\/(plain|csv))$/
      if (!ACCEPTED_MIME.test(file.type)) {
        setError('Please upload a JPEG, PNG, WebP, PDF, TXT, or CSV file.')
        return
      }

      setError(null)
      setPhase('processing')

      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          setError('Session expired. Please refresh and try again.')
          setPhase('idle')
          return
        }

        const ext = EXT_MAP[file.type] ?? 'jpg'
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, file, { contentType: file.type })

        if (uploadError) {
          setError(`Upload failed: ${uploadError.message}`)
          setPhase('idle')
          return
        }

        const parseRes = await fetch('/api/receipts/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storagePath: path }),
        })

        if (!parseRes.ok) {
          const body = await parseRes.json().catch(() => ({}))
          const msg =
            body.error === 'NO_ITEMS_FOUND'
              ? 'No items found on this receipt. Try a clearer photo.'
              : body.error === 'UNSUPPORTED_FILE_TYPE'
                ? "This file type isn't supported. Upload a JPEG, PNG, WebP, PDF, TXT, or CSV."
                : body.error === 'FILE_TOO_LARGE'
                  ? 'File is too large. PDFs must be under 20 MB, text files under 1 MB.'
                  : `OCR failed (${body.error ?? parseRes.status}). Please try again.`
          setError(msg)
          setPhase('idle')
          return
        }

        const receipt = (await parseRes.json()) as ParsedReceiptResponse

        setReview({
          store: receipt.store,
          date: receipt.date,
          wallet_id: wallets[0]?.id ?? '',
          total: receipt.total,
          discrepancy_warning: receipt.discrepancy_warning,
          items: receipt.items.map((item) => {
            const raw = item.raw_name ?? item.name
            const displayName =
              item.canonical_product_name ?? item.normalized_name ?? item.name
            return {
              display_name: displayName,
              raw_name: raw,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              category_id: matchCategory(item.category, categories),
              confidence: item.confidence,
              normalized_name: item.normalized_name ?? null,
              canonical_product_name: item.canonical_product_name ?? null,
              brand: item.brand ?? null,
              size_value: item.size_value ?? null,
              size_unit: item.size_unit ?? null,
              flavor: item.flavor ?? null,
              variant: item.variant ?? null,
              gtin: item.gtin ?? null,
              normalization_confidence: item.normalization_confidence ?? null,
              enrichment_confidence: item.enrichment_confidence ?? null,
              normalization_source: item.normalization_source ?? null,
              enrichment_source: item.enrichment_source ?? null,
              needs_review: item.needs_review ?? false,
              product_fingerprint: item.product_fingerprint ?? null,
            }
          }),
        })
        setPhase('review')
      } catch (err) {
        setError('An unexpected error occurred. Please try again.')
        setPhase('idle')
        console.error('[receipt-upload]', err)
      }
    },
    [wallets, categories],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ''
    },
    [processFile],
  )

  const updateItem = useCallback(
    (index: number, patch: Partial<ReviewItem>) => {
      setReview((prev) => {
        if (!prev) return prev
        const items = [...prev.items]
        items[index] = { ...items[index], ...patch }
        return { ...prev, items }
      })
    },
    [],
  )

  const handleSave = useCallback(() => {
    if (!review) return
    startTransition(async () => {
      const result = await onSave({
        store: review.store,
        date: review.date,
        wallet_id: review.wallet_id || null,
        total: review.total,
        items: review.items.map((item) => ({
          // name = what the user confirmed/edited
          name: item.display_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          category_id: item.category_id || null,
          confidence: item.confidence,
          // Enrichment passthrough
          raw_name: item.raw_name,
          normalized_name: item.normalized_name,
          canonical_product_name: item.canonical_product_name,
          brand: item.brand,
          size_value: item.size_value,
          size_unit: item.size_unit,
          flavor: item.flavor,
          variant: item.variant,
          gtin: item.gtin,
          normalization_confidence: item.normalization_confidence,
          enrichment_confidence: item.enrichment_confidence,
          normalization_source: item.normalization_source,
          enrichment_source: item.enrichment_source,
          product_fingerprint: item.product_fingerprint,
          needs_review: false, // user has reviewed — clear the flag
          // Mark as confirmed if we had normalization data
          user_confirmed: item.normalized_name !== null,
        })),
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push('/dashboard/transactions')
      }
    })
  }, [review, onSave, router])

  const reset = useCallback(() => {
    setPhase('idle')
    setReview(null)
    setError(null)
  }, [])

  if (phase === 'idle' || phase === 'processing') {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload receipt image"
          className={[
            'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors',
            isDragging
              ? 'border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800'
              : 'border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600',
            phase === 'processing' ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
          onDragEnter={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setIsDragging(false)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => phase === 'idle' && inputRef.current?.click()}
          onKeyDown={(e) =>
            e.key === 'Enter' && phase === 'idle' && inputRef.current?.click()
          }
        >
          {phase === 'processing' ? (
            <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <svg
                className="h-8 w-8 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm font-medium">Analyzing receipt&hellip;</p>
              <p className="text-xs text-zinc-400">
                This usually takes 5–15 seconds
              </p>
            </div>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10 text-zinc-400"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Click to upload or drag &amp; drop
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  JPEG, PNG, WebP, PDF, TXT or CSV
                </p>
              </div>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,text/plain,.txt,text/csv,.csv"
            className="sr-only"
            onChange={handleFileChange}
            tabIndex={-1}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (!review) return null

  const needsReviewCount = review.items.filter((i) => i.needs_review).length

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* Header fields */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Store
            </label>
            <input
              type="text"
              value={review.store}
              onChange={(e) =>
                setReview((p) => (p ? { ...p, store: e.target.value } : p))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Date
            </label>
            <input
              type="date"
              value={review.date}
              onChange={(e) =>
                setReview((p) => (p ? { ...p, date: e.target.value } : p))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Wallet
            </label>
            <select
              value={review.wallet_id}
              onChange={(e) =>
                setReview((p) =>
                  p ? { ...p, wallet_id: e.target.value } : p,
                )
              }
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">— no wallet —</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {review.discrepancy_warning && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          Item totals don&apos;t match the receipt total. The receipt total will
          be used when saving.
        </p>
      )}

      {needsReviewCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          {needsReviewCount} item{needsReviewCount > 1 ? 's' : ''} flagged for
          review — the AI was less confident about the product name. Check and
          correct if needed before saving.
        </p>
      )}

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Product
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Unit price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Category
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {review.items.map((item, i) => {
                const normBadge = normConfidenceLabel(
                  item.normalization_confidence,
                  item.needs_review,
                )
                const wasNormalized =
                  item.normalized_name !== null &&
                  item.raw_name !== item.display_name
                const rowHighlight = item.needs_review
                  ? 'border-l-2 border-l-amber-400'
                  : ''

                return (
                  <tr key={i} className={rowHighlight}>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item.display_name}
                            onChange={(e) =>
                              updateItem(i, { display_name: e.target.value })
                            }
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-zinc-900 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none dark:text-zinc-100 dark:hover:border-zinc-600"
                          />
                          {item.confidence === 'low' && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                              low OCR
                            </span>
                          )}
                          {normBadge && (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${normBadge.className}`}
                            >
                              {normBadge.label}
                            </span>
                          )}
                        </div>
                        {wasNormalized && (
                          <p className="pl-1 text-xs text-zinc-400 dark:text-zinc-500">
                            Scanned: {item.raw_name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                      {PLN.format(item.unit_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                      {PLN.format(item.total_price)}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={item.category_id}
                        onChange={(e) =>
                          updateItem(i, { category_id: e.target.value })
                        }
                        className="w-full rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        <option value="">— uncategorised —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-zinc-200 dark:border-zinc-700">
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400"
                >
                  Receipt total
                </td>
                <td className="px-4 py-3 text-right text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {PLN.format(review.total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isPending ? 'Saving…' : 'Save to database'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
        >
          Start over
        </button>
      </div>
    </div>
  )
}

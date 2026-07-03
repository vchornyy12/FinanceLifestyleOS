'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Phase = 'idle' | 'uploading' | 'processing' | 'saved' | 'failed'

interface SavedInfo {
  store: string
  total: number
}

const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 })

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

const ACCEPTED_MIME = /^(image\/(jpeg|png|webp)|application\/pdf|text\/(plain|csv))$/

const SIZE_LIMITS: Array<{ test: (t: string) => boolean; limit: number; label: string }> = [
  { test: (t) => t === 'application/pdf', limit: 20 * 1024 * 1024, label: '20 MB' },
  { test: (t) => t.startsWith('text/'), limit: 1 * 1024 * 1024, label: '1 MB' },
  { test: (t) => t.startsWith('image/'), limit: 5 * 1024 * 1024, label: '5 MB' },
]

function errorMessage(code: string): string {
  switch (code) {
    case 'NO_ITEMS_FOUND':
      return 'No items found on this receipt. Try a clearer photo.'
    case 'UNSUPPORTED_FILE_TYPE':
      return "This file type isn't supported."
    case 'FILE_TOO_LARGE':
      return 'File is too large.'
    case 'SAVE_FAILED':
      return "Parsed the receipt but couldn't save it — please try again."
    case 'TIMEOUT':
    case 'STALLED':
      return 'Processing timed out. The receipt may be too complex — try a clearer photo.'
    default:
      return `Something went wrong (${code}). Please try again.`
  }
}

async function pollUntilSaved(jobId: string, token: string, signal: AbortSignal): Promise<SavedInfo> {
  const MAX_POLLS = 72 // 72 × 2.5 s = 180 s max
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, 2500))
    if (signal.aborted) throw new Error('CANCELLED')
    const res = await fetch(`/api/receipts/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
    if (!res.ok) throw new Error('POLL_FAILED')
    const { status, result, errorCode } = await res.json()
    if (status === 'done') {
      return { store: result?.store ?? 'Receipt', total: Number(result?.total ?? 0) }
    }
    if (status === 'error') throw new Error(errorCode ?? 'OCR_FAILED')
  }
  throw new Error('TIMEOUT')
}

/**
 * Zero-touch receipt upload: pick or drop a file and everything else —
 * parsing, categorization, saving — happens server-side. The status shown
 * here is informational; navigating away does not cancel the save.
 */
export default function QuickUpload() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { pollAbortRef.current?.abort() }, [])

  const processFile = useCallback(
    async (file: File) => {
      if (phase === 'uploading' || phase === 'processing') return

      if (!ACCEPTED_MIME.test(file.type)) {
        setPhase('failed')
        setMessage('Please upload a JPEG, PNG, WebP, PDF, TXT, or CSV file.')
        return
      }
      const sizeRule = SIZE_LIMITS.find((r) => r.test(file.type))
      if (sizeRule && file.size > sizeRule.limit) {
        setPhase('failed')
        setMessage(`File is too large (max ${sizeRule.label}).`)
        return
      }

      setMessage(null)
      setPhase('uploading')

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setPhase('failed')
          setMessage('Session expired. Please refresh and try again.')
          return
        }

        const ext = EXT_MAP[file.type] ?? 'jpg'
        const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, file, { contentType: file.type })
        if (uploadError) {
          setPhase('failed')
          setMessage(`Upload failed: ${uploadError.message}`)
          return
        }

        const parseRes = await fetch('/api/receipts/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storagePath: path, autoSave: true }),
        })
        if (!parseRes.ok) {
          const body = await parseRes.json().catch(() => ({}))
          setPhase('failed')
          setMessage(errorMessage(body.error ?? String(parseRes.status)))
          return
        }

        const { jobId } = await parseRes.json()
        setPhase('processing')

        const abort = new AbortController()
        pollAbortRef.current = abort

        const saved = await pollUntilSaved(jobId, session.access_token, abort.signal)
        setPhase('saved')
        setMessage(`Saved ✓ ${saved.store} · ${PLN.format(saved.total)}`)
        router.refresh()
      } catch (err) {
        const code = err instanceof Error ? err.message : 'UNKNOWN'
        if (code === 'CANCELLED') return
        setPhase('failed')
        setMessage(errorMessage(code))
      }
    },
    [phase, router],
  )

  const onPick = () => inputRef.current?.click()
  const busy = phase === 'uploading' || phase === 'processing'

  return (
    <section>
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick() }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void processFile(file)
        }}
        aria-busy={busy}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
            : 'border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void processFile(file)
          }}
        />

        {busy ? (
          <>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {phase === 'uploading' ? 'Uploading…' : 'Reading your receipt…'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              You can leave this page — it saves automatically.
            </p>
          </>
        ) : (
          <>
            <span className="text-2xl" aria-hidden="true">🧾</span>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Drop a receipt here, or tap to snap one
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              That&apos;s it — it&apos;s parsed, categorized, and saved automatically.
            </p>
          </>
        )}

        {message && (
          <p
            className={[
              'mt-1 text-sm font-medium',
              phase === 'saved'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
            ].join(' ')}
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  )
}

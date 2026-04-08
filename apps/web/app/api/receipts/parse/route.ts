import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { RECEIPT_SYSTEM_PROMPT, buildReceiptUserMessage } from '@/lib/ocr/parseReceiptPrompt'
import { ParsedReceiptSchema } from '@/lib/ocr/receiptSchema'

// Lazy singletons — initialized on first request, not at module evaluation time.
// Module-level createClient() calls throw during `next build` if env vars are
// missing, so we defer construction to the first POST handler invocation.
let _anthropic: Anthropic | null = null
let _supabaseAdmin: ReturnType<typeof createClient> | null = null

function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _supabaseAdmin
}

// Module-level map — resets on cold start, sufficient for cost control
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number]

function isAllowedMimeType(t: string): t is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(t)
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [id, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(id)
      break // prune at most one stale entry per call, O(1) overhead
    }
  }
  const limit = rateLimitMap.get(userId)
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3600_000 })
    return true
  }
  if (limit.count >= 20) return false
  limit.count++
  return true
}

const RequestSchema = z.object({ storagePath: z.string().min(1) })

// CORS: This route is intentionally same-origin only (Next.js default).
// The mobile app calls it via EXPO_PUBLIC_API_BASE_URL which points to the
// Next.js server — no cross-origin browser traffic is expected.
export async function POST(req: NextRequest) {
  try {
    // Auth validation
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[ocr] auth_failure: missing or malformed Authorization header')
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const {
      data: { user },
      error: userError,
    } = await getSupabaseAdmin().auth.getUser(token)
    if (userError || !user) {
      console.error('[ocr] auth_failure: invalid token', userError?.message)
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    // Rate limiting — 20 req/hour per user
    if (!checkRateLimit(user.id)) {
      console.error('[ocr] rate_limited: user=%s', user.id)
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
    }

    // Request body validation
    const parseResult = RequestSchema.safeParse(await req.json())
    if (!parseResult.success) {
      console.error('[ocr] invalid_request: body failed schema validation')
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    }
    const { storagePath } = parseResult.data

    // Storage path traversal prevention
    if (!storagePath.startsWith(user.id + '/')) {
      console.error('[ocr] forbidden: path_traversal attempt user=%s path=%s', user.id, storagePath)
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Image fetch — generate signed URL then fetch with timeout
    const { data: signedUrlData, error: urlError } = await getSupabaseAdmin().storage
      .from('receipts')
      .createSignedUrl(storagePath, 120)
    if (urlError || !signedUrlData?.signedUrl) {
      console.error('[ocr] storage_error: failed to create signed URL for path=%s', storagePath, urlError?.message)
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    const imageRes = await fetch(signedUrlData.signedUrl, {
      signal: AbortSignal.timeout(25_000),
    })
    const imageBuffer = await imageRes.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    const rawMime = (imageRes.headers.get('content-type') ?? '').split(';')[0].trim()
    const mimeType: AllowedMimeType = isAllowedMimeType(rawMime) ? rawMime : 'image/jpeg'

    // Claude vision call
    // Known risk: malicious receipt images could attempt prompt injection via
    // embedded text. Mitigated by strict JSON-only system prompt and
    // ParsedReceiptSchema validation on the response — freeform text output
    // is rejected at the schema layer.
    let message
    try {
      message = await getAnthropic().messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: RECEIPT_SYSTEM_PROMPT,
        messages: [buildReceiptUserMessage(imageBase64, mimeType)],
      })
    } catch (anthropicErr) {
      console.error('[ocr] anthropic_error:', anthropicErr instanceof Error ? anthropicErr.message : anthropicErr)
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse and validate response
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.error('[ocr] parse_error: Claude response was not valid JSON (first 200 chars): %s', rawText.slice(0, 200))
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    // Handle Claude returning error object
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return NextResponse.json({ error: 'NO_ITEMS_FOUND' }, { status: 422 })
    }

    const validationResult = ParsedReceiptSchema.safeParse(parsed)
    if (!validationResult.success) {
      console.error('[ocr] schema_error: Claude response failed schema validation', validationResult.error.flatten())
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }
    const receipt = validationResult.data

    // Discrepancy check
    const itemsSum = receipt.items.reduce((sum, item) => sum + item.total_price, 0)
    if (Math.abs(itemsSum - receipt.total) > 1.0) {
      receipt.discrepancy_warning = true
    }

    return NextResponse.json(receipt)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      console.error('[ocr] timeout: image fetch exceeded 25s')
      return NextResponse.json({ error: 'TIMEOUT' }, { status: 504 })
    }
    console.error('[ocr] unhandled_error:', err)
    return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
  }
}

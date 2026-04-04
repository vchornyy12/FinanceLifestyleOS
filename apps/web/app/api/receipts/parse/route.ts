import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { RECEIPT_SYSTEM_PROMPT, buildReceiptUserMessage } from '@/lib/ocr/parseReceiptPrompt'
import { ParsedReceiptSchema } from '@/lib/ocr/receiptSchema'

// Module-level instances — reused across requests within the same Lambda/Edge instance
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Module-level map — resets on cold start, sufficient for cost control
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
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

export async function POST(req: NextRequest) {
  try {
    // Auth validation
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    // Rate limiting — 20 req/hour per user
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
    }

    // Request body validation
    const parseResult = RequestSchema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    }
    const { storagePath } = parseResult.data

    // Storage path traversal prevention
    if (!storagePath.startsWith(user.id + '/')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    // Image fetch — generate signed URL then fetch with timeout
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('receipts')
      .createSignedUrl(storagePath, 120)
    if (urlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    const imageRes = await fetch(signedUrlData.signedUrl, {
      signal: AbortSignal.timeout(25_000),
    })
    const imageBuffer = await imageRes.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'

    // Claude vision call
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: RECEIPT_SYSTEM_PROMPT,
      messages: [buildReceiptUserMessage(imageBase64, mimeType)],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse and validate response
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    // Handle Claude returning error object
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return NextResponse.json({ error: 'NO_ITEMS_FOUND' }, { status: 422 })
    }

    const validationResult = ParsedReceiptSchema.safeParse(parsed)
    if (!validationResult.success) {
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
      return NextResponse.json({ error: 'TIMEOUT' }, { status: 504 })
    }
    return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
  }
}

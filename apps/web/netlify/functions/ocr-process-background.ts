import type { Config } from '@netlify/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  RECEIPT_SYSTEM_PROMPT,
  buildReceiptUserMessage,
  buildReceiptDocumentMessage,
  buildReceiptTextMessage,
} from '../../lib/ocr/parseReceiptPrompt'
import { ParsedReceiptSchema } from '../../lib/ocr/receiptSchema'
import { normalizeReceiptItem } from '../../lib/normalization/normalize'
import { getEnrichmentProvider } from '../../lib/enrichment/factory'

const PDF_LIMIT = 20 * 1024 * 1024
const TEXT_LIMIT = 1 * 1024 * 1024
const IMAGE_LIMIT = 5 * 1024 * 1024
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

function isImageMime(t: string): t is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(t)
}

function isAllowedMimeType(t: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'].includes(t)
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(Buffer.from(buffer))
    return result.text ?? ''
  } catch {
    return ''
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function processOcrJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: job, error: jobFetchError } = await supabase
    .from('receipt_parse_jobs')
    .select('id, user_id, storage_path, status')
    .eq('id', jobId)
    .single()

  if (jobFetchError || !job) {
    console.error('[ocr-bg] job_not_found: jobId=%s', jobId)
    return
  }

  const { data: claimed, error: processingUpdateError } = await supabase
    .from('receipt_parse_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .single()
  if (processingUpdateError || !claimed) {
    console.log('[ocr-bg] job_already_claimed_or_gone: jobId=%s', jobId)
    return
  }

  async function failJob(errorCode: string) {
    await supabase
      .from('receipt_parse_jobs')
      .update({ status: 'error', error_code: errorCode, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'processing')
  }

  try {
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('receipts')
      .createSignedUrl(job.storage_path, 120)
    if (urlError || !signedUrlData?.signedUrl) {
      console.error('[ocr-bg] storage_error: jobId=%s', jobId, urlError?.message)
      return failJob('PARSE_FAILED')
    }

    const imageRes = await fetch(signedUrlData.signedUrl, {
      signal: AbortSignal.timeout(30_000),
    })
    if (!imageRes.ok) {
      console.error('[ocr-bg] fetch_error: jobId=%s status=%d', jobId, imageRes.status)
      return failJob('PARSE_FAILED')
    }
    const imageBuffer = await imageRes.arrayBuffer()
    const rawMime = (imageRes.headers.get('content-type') ?? '').split(';')[0].trim()

    if (!isAllowedMimeType(rawMime)) {
      return failJob('UNSUPPORTED_FILE_TYPE')
    }
    if (rawMime === 'application/pdf' && imageBuffer.byteLength > PDF_LIMIT) {
      return failJob('FILE_TOO_LARGE')
    }
    if ((rawMime === 'text/plain' || rawMime === 'text/csv') && imageBuffer.byteLength > TEXT_LIMIT) {
      return failJob('FILE_TOO_LARGE')
    }
    if (isImageMime(rawMime) && imageBuffer.byteLength > IMAGE_LIMIT) {
      return failJob('FILE_TOO_LARGE')
    }

    let userMessage
    if (isImageMime(rawMime)) {
      const imageBase64 = Buffer.from(imageBuffer).toString('base64')
      userMessage = buildReceiptUserMessage(imageBase64, rawMime)
    } else if (rawMime === 'application/pdf') {
      const extractedText = await extractPdfText(imageBuffer)
      if (extractedText.trim().length >= 150) {
        userMessage = buildReceiptTextMessage(extractedText)
      } else {
        const pdfBase64 = Buffer.from(imageBuffer).toString('base64')
        userMessage = buildReceiptDocumentMessage(pdfBase64)
      }
    } else {
      const text = Buffer.from(imageBuffer).toString('utf-8')
      userMessage = buildReceiptTextMessage(text)
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: [{ type: 'text', text: RECEIPT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [userMessage],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error('[ocr-bg] parse_error: jobId=%s stop_reason=%s', jobId, message.stop_reason)
      return failJob('PARSE_FAILED')
    }

    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return failJob('NO_ITEMS_FOUND')
    }

    const validationResult = ParsedReceiptSchema.safeParse(parsed)
    if (!validationResult.success) {
      console.error('[ocr-bg] schema_error: jobId=%s', jobId, validationResult.error.flatten())
      return failJob('PARSE_FAILED')
    }

    const receipt = validationResult.data
    const itemsSum = receipt.items.reduce((sum, item) => sum + item.total_price, 0)
    if (Math.abs(itemsSum - receipt.total) > 1.0) {
      receipt.discrepancy_warning = true
    }

    const enrichmentProvider = getEnrichmentProvider()
    const enrichedItems = await Promise.all(
      receipt.items.map(async (item) => {
        try {
          const norm = await normalizeReceiptItem(item.name, job.user_id, receipt.store, supabase)
          let enrichment = null
          if (norm.attributes.size_value || norm.normalizedName) {
            enrichment = await enrichmentProvider.lookup({ name: norm.normalizedName })
          }
          return {
            ...item,
            raw_name: norm.rawName,
            normalized_name: norm.normalizedName,
            canonical_product_name: enrichment?.canonical_product_name ?? norm.canonical_product_name,
            brand: enrichment?.brand ?? null,
            size_value: norm.attributes.size_value,
            size_unit: norm.attributes.size_unit,
            flavor: norm.attributes.flavor,
            variant: norm.attributes.variant,
            gtin: enrichment?.gtin ?? null,
            normalization_confidence: norm.confidence,
            enrichment_confidence: enrichment?.confidence ?? null,
            normalization_source: norm.source,
            enrichment_source: enrichment?.source ?? null,
            needs_review: norm.needs_review,
            product_fingerprint: norm.fingerprint,
          }
        } catch {
          return { ...item, raw_name: item.name, needs_review: true }
        }
      }),
    )

    const result = { ...receipt, items: enrichedItems }

    const { error: doneUpdateError } = await supabase
      .from('receipt_parse_jobs')
      .update({ status: 'done', result, updated_at: new Date().toISOString() })
      .eq('id', jobId)
    if (doneUpdateError) {
      console.error('[ocr-bg] done_write_error: jobId=%s', jobId, doneUpdateError.message)
      await failJob('PARSE_FAILED')
      return
    }

    console.log('[ocr-bg] done: jobId=%s items=%d', jobId, enrichedItems.length)
  } catch (err) {
    console.error('[ocr-bg] unhandled_error: jobId=%s', jobId, err)
    await failJob('PARSE_FAILED')
  }
}

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handler(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch { return new Response('Bad Request', { status: 400 }) }

  if (typeof body !== 'object' || body === null) return new Response('Bad Request', { status: 400 })
  const { jobId, sig } = body as { jobId?: unknown; sig?: unknown }

  if (typeof jobId !== 'string' || !JOB_ID_RE.test(jobId)) {
    return new Response('Bad Request', { status: 400 })
  }

  const bgSecret = process.env.BG_TRIGGER_SECRET
  if (bgSecret) {
    const expected = createHmac('sha256', bgSecret).update(jobId).digest()
    const provided = typeof sig === 'string' ? Buffer.from(sig, 'hex') : Buffer.alloc(0)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  await processOcrJob(jobId)
  return new Response(null, { status: 202 })
}

export default handler

export const config: Config = {}

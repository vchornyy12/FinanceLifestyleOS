import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/types/database'

let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null

class ServerMisconfiguredError extends Error {
  constructor(missing: string) {
    super(`Missing required env var: ${missing}`)
    this.name = 'ServerMisconfiguredError'
  }
}

function getSupabaseAdmin(): ReturnType<typeof createClient<Database>> {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new ServerMisconfiguredError('NEXT_PUBLIC_SUPABASE_URL')
    if (!key) throw new ServerMisconfiguredError('SUPABASE_SERVICE_ROLE_KEY')
    _supabaseAdmin = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  for (const [id, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(id)
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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }
    const token = authHeader.slice(7)

    const { data: { user }, error: userError } = await getSupabaseAdmin().auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
    }

    const parseResult = RequestSchema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    }
    const { storagePath } = parseResult.data

    if (!storagePath.startsWith(user.id + '/')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const { data: job, error: jobError } = await getSupabaseAdmin()
      .from('receipt_parse_jobs')
      .insert({ user_id: user.id, storage_path: storagePath })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('[ocr] job_insert_error:', jobError?.message)
      return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
    }

    // Trigger the background function — it returns 202 immediately and processes async
    const siteUrl = process.env.URL ?? 'http://localhost:8888'
    await fetch(`${siteUrl}/.netlify/functions/ocr-process-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
      signal: AbortSignal.timeout(5_000),
    }).catch((err) => {
      // Non-fatal: job row exists, frontend can still poll.
      console.error('[ocr] bg_trigger_error:', err)
    })

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (err) {
    if (err instanceof ServerMisconfiguredError) {
      console.error('[ocr] server_misconfigured:', err.message)
      return NextResponse.json({ error: 'SERVER_MISCONFIGURED' }, { status: 503 })
    }
    console.error('[ocr] unhandled_error:', err)
    return NextResponse.json({ error: 'PARSE_FAILED' }, { status: 500 })
  }
}

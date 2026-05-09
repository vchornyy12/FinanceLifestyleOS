import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let _supabaseAdmin: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  }
  return _supabaseAdmin
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: userError } = await getSupabaseAdmin().auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const { id } = await params

  const { data: job, error: jobError } = await getSupabaseAdmin()
    .from('receipt_parse_jobs')
    .select('id, user_id, status, result, error_code')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  if (job.user_id !== user.id) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  return NextResponse.json({
    status: job.status,
    result: job.result ?? undefined,
    errorCode: job.error_code ?? undefined,
  })
}

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getMonthlyMetrics } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY!,
      baseURL: process.env.NVIDIA_BASE_URL!,
    })
  }
  return _openai
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429 })
    }

    const { message } = await req.json() as { message: string }
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'EMPTY_MESSAGE' }), { status: 400 })
    }

    // Load last 20 messages for LLM context (authoritative from DB)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .order('created_at', { ascending: false })
      .limit(20)
    const orderedHistory = (history ?? []).reverse()

    // Fetch financial context in parallel
    const yearMonth = currentYearMonth()
    const [metrics, wallets, txResult] = await Promise.all([
      getMonthlyMetrics(yearMonth),
      getUserWalletsWithBalances(supabase),
      supabase
        .from('transactions')
        .select('date, merchant, type, amount, category:categories(name)')
        .order('date', { ascending: false })
        .limit(50),
    ])

    const transactions = (txResult.data ?? []).map((t) => ({
      date: t.date,
      merchant: t.merchant,
      type: t.type as 'expense' | 'income' | 'transfer',
      amount: t.amount as unknown as string,
      category: (t.category as unknown as { name: string } | null)?.name ?? null,
    }))

    const systemPrompt = buildSystemPrompt({
      today: new Date().toISOString().slice(0, 10),
      yearMonth,
      metrics,
      wallets,
      transactions,
    })

    const stream = await getOpenAI().chat.completions.create({
      model: process.env.NVIDIA_MODEL!,
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...orderedHistory,
        { role: 'user', content: message },
      ],
    })

    let assistantReply = ''

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) {
              assistantReply += text
              controller.enqueue(encoder.encode(text))
            }
          }
        } finally {
          controller.close()
          // Persist both messages after stream completes
          await supabase.from('chat_messages').insert([
            { user_id: user.id, role: 'user', content: message },
            { user_id: user.id, role: 'assistant', content: assistantReply },
          ])
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[chat] error', err)
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 })
  }
}

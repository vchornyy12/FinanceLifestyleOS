import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { receiptQueryTool, executeReceiptQuery, assembleToolCallDeltas, type ToolCallDelta } from '@/lib/chat/tools'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseJSClient } from '@supabase/supabase-js'
import { getMonthlyMetrics } from '@/lib/supabase/queries/metrics'
import { getUserWalletsWithBalances } from '@/lib/supabase/queries/wallets'
import { getTopProducts, getRecentReceiptsWithItems } from '@/lib/supabase/queries/receiptItems'
import { buildSystemPrompt } from '@/lib/chat/systemPrompt'

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.NVIDIA_API_KEY
    const base = process.env.NVIDIA_BASE_URL
    if (!key) throw new Error('Missing env var: NVIDIA_API_KEY')
    if (!base) throw new Error('Missing env var: NVIDIA_BASE_URL')
    _openai = new OpenAI({ apiKey: key, baseURL: base })
  }
  return _openai
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  // Prune one stale entry per call to bound map size
  for (const [id, entry] of rateLimitMap) {
    if (now > entry.resetAt) { rateLimitMap.delete(id) }
    break
  }
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
    const authHeader = req.headers.get('Authorization')
    let supabase
    let user

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      supabase = createSupabaseJSClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 })
      }
      user = authUser
    } else {
      supabase = await createClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 })
      }
      user = authUser
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    const orderedHistory = (history ?? []).reverse()

    // Fetch financial context in parallel
    const yearMonth = currentYearMonth()
    const [metrics, wallets, txResult, topProducts, recentReceipts] = await Promise.all([
      getMonthlyMetrics(yearMonth, supabase),
      getUserWalletsWithBalances(supabase),
      supabase
        .from('transactions')
        .select('date, merchant, type, amount, category:categories(name)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50),
      getTopProducts(yearMonth, supabase),
      // Receipt line items are additive context — never let them break chat.
      getRecentReceiptsWithItems(10, supabase).catch(() => []),
    ])

    const transactions = (txResult.data ?? []).map((t) => ({
      date: t.date,
      merchant: t.merchant,
      type: t.type as 'expense' | 'income' | 'transfer',
      amount: t.amount as unknown as string,
      category: (() => {
        const cat = t.category as unknown as { name: string } | { name: string }[] | null
        if (!cat) return null
        return Array.isArray(cat) ? (cat[0]?.name ?? null) : cat.name
      })(),
    }))

    const systemPrompt = buildSystemPrompt({
      today: new Date().toISOString().slice(0, 10),
      yearMonth,
      metrics,
      wallets,
      transactions,
      topProducts,
      recentReceipts,
    })

    const model = process.env.NVIDIA_MODEL
    if (!model) throw new Error('Missing env var: NVIDIA_MODEL')

    const conversation: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(orderedHistory as ChatCompletionMessageParam[]),
      { role: 'user', content: message },
    ]

    const MAX_TOOL_ROUNDS = 3
    let assistantReply = ''

    async function createStream(withTools: boolean) {
      return getOpenAI().chat.completions.create({
        model: model!,
        stream: true,
        max_tokens: 16384,
        temperature: 0.7,
        top_p: 1,
        messages: conversation,
        ...(withTools ? { tools: [receiptQueryTool] } : {}),
      })
    }

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          let toolsEnabled = true

          for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
            // Last permitted round runs without tools so the user always gets prose.
            const withTools = toolsEnabled && round < MAX_TOOL_ROUNDS

            let stream
            try {
              stream = await createStream(withTools)
            } catch (err) {
              if (!withTools) throw err
              // Model/provider rejected the tools param — degrade gracefully.
              console.error('[chat] tools_unsupported, retrying without tools', err)
              toolsEnabled = false
              stream = await createStream(false)
            }

            const toolCallChunks: ToolCallDelta[][] = []
            let finishReason: string | null = null

            for await (const chunk of stream) {
              const choice = chunk.choices[0]
              const text = choice?.delta?.content ?? ''
              if (text) {
                assistantReply += text
                controller.enqueue(encoder.encode(text))
              }
              if (choice?.delta?.tool_calls) {
                toolCallChunks.push(choice.delta.tool_calls as ToolCallDelta[])
              }
              if (choice?.finish_reason) finishReason = choice.finish_reason
            }

            if (finishReason !== 'tool_calls') break

            const calls = assembleToolCallDeltas(toolCallChunks)
            conversation.push({
              role: 'assistant',
              content: null,
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: c.arguments },
              })),
            })
            for (const call of calls) {
              let args: unknown
              try { args = JSON.parse(call.arguments || '{}') } catch { args = call.arguments }
              const result = call.name === 'query_receipt_items'
                ? await executeReceiptQuery(supabase, args)
                : JSON.stringify({ error: `Unknown tool: ${call.name}` })
              conversation.push({ role: 'tool', tool_call_id: call.id, content: result })
            }
          }

          controller.close()
        } catch (err) {
          controller.error(err)
        } finally {
          if (assistantReply) {
            // Persist both messages after stream completes
            await supabase.from('chat_messages').insert([
              { user_id: user.id, role: 'user', content: message },
              { user_id: user.id, role: 'assistant', content: assistantReply },
            ])
          }
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const status = (err as { status?: number }).status
    const body = (err as { error?: unknown }).error
    console.error('[chat] error', { status, body, err })
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Transaction } from '@/types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/history
 * Returns paginated transaction history grouped by date for the current vendor.
 *
 * Query params:
 *   page  — 1-indexed page number (default: 1)
 *   limit — items per page (default: 10, max: 50)
 *   date  — optional YYYY-MM-DD to fetch a single day's transactions
 *
 * Response:
 *   { groups: DateGroup[], total: number, page: number, totalPages: number }
 */

export interface DateGroup {
  date: string                // YYYY-MM-DD
  transactions: Transaction[]
  total_expense: number
  total_revenue: number
  net_profit: number
}

export async function GET(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)))
  const dateFilter = searchParams.get('date') // optional single-day filter

  if (dateFilter) {
    // Single day — used by history page expand
    const start = `${dateFilter}T00:00:00.000Z`
    const end   = `${dateFilter}T23:59:59.999Z`

    const { data, error } = await sb()
      .from('transactions')
      .select('*')
      .eq('vendor_id', vendorId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const txList = (data ?? []) as Transaction[]
    const group  = buildGroup(dateFilter, txList)

    // Also pull daily_summary text if available
    const { data: daily } = await sb()
      .from('daily_summaries')
      .select('summary_text_hi')
      .eq('vendor_id', vendorId)
      .eq('date', dateFilter)
      .single()

    return NextResponse.json({ group, summary_text_hi: daily?.summary_text_hi ?? null })
  }

  // ── Paginated: fetch last N days of distinct dates, then transactions ──
  // Step 1: get distinct dates with transactions (newest first), paginated
  const offset = (page - 1) * limit

  // Fetch all transactions for this vendor ordered by date desc,
  // then group client-side (Supabase free tier doesn't support GROUP BY well)
  // We over-fetch slightly to get accurate totals: fetch last 6 months max
  const { data: allTx, error } = await sb()
    .from('transactions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('logged_at', { ascending: false })
    .limit(2000) // safety cap — 2000 tx covers ~200 days of 10 tx/day

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const txList = (allTx ?? []) as Transaction[]

  // Step 2: group by calendar date (IST — use logged_at date part)
  const dateMap = new Map<string, Transaction[]>()
  for (const tx of txList) {
    const d = tx.logged_at.slice(0, 10) // YYYY-MM-DD (UTC date from DB)
    if (!dateMap.has(d)) dateMap.set(d, [])
    dateMap.get(d)!.push(tx)
  }

  // Step 3: sort dates newest-first, paginate
  const allDates   = [...dateMap.keys()].sort((a, b) => b.localeCompare(a))
  const totalDates = allDates.length
  const totalPages = Math.ceil(totalDates / limit)
  const pageDates  = allDates.slice(offset, offset + limit)

  // Fetch summary_text_hi for all dates on this page in one query
  const { data: summaries } = await sb()
    .from('daily_summaries')
    .select('date, summary_text_hi')
    .eq('vendor_id', vendorId)
    .in('date', pageDates)

  const summaryMap = new Map<string, string | null>(
    (summaries ?? []).map(s => [s.date, s.summary_text_hi])
  )

  const groups: (DateGroup & { summary_text_hi: string | null })[] = pageDates.map(d => ({
    ...buildGroup(d, dateMap.get(d) ?? []),
    summary_text_hi: summaryMap.get(d) ?? null,
  }))

  return NextResponse.json({
    groups,
    total:      totalDates,
    page,
    totalPages,
    limit,
  })
}

function buildGroup(date: string, txList: Transaction[]): DateGroup {
  const total_expense = txList.filter(t => t.entry_type === 'expense' || t.entry_type === 'spoilage')
    .reduce((s, t) => s + t.total_amount, 0)
  const total_revenue = txList.filter(t => t.entry_type === 'sale')
    .reduce((s, t) => s + t.total_amount, 0)
  return {
    date,
    transactions: txList,
    total_expense,
    total_revenue,
    net_profit: total_revenue - total_expense,
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computePnL } from '@/lib/pnl'
import type { Transaction } from '@/types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/get-summary
 * Returns today's P&L and transaction list for the current vendor.
 * Optional query param: ?date=YYYY-MM-DD for historical lookup.
 * Response: GetSummaryResponse
 */
export async function GET(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  // Build UTC day range for the requested date
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  const { data: transactions, error } = await sb()
    .from('transactions')
    .select('*')
    .eq('vendor_id', vendorId)
    .gte('logged_at', startOfDay)
    .lte('logged_at', endOfDay)
    .order('logged_at', { ascending: false })

  if (error) {
    console.error('[get-summary] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const txList = (transactions ?? []) as Transaction[]
  const summary = computePnL(txList)

  // Fetch existing daily summary text if available
  const { data: daily } = await sb()
    .from('daily_summaries')
    .select('summary_text_hi')
    .eq('vendor_id', vendorId)
    .eq('date', date)
    .single()

  return NextResponse.json({
    summary,
    transactions: txList,
    summary_text_hi: daily?.summary_text_hi ?? null,
  })
}

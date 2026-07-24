import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/trend?days=7
 * Returns N days of daily P&L data for the current vendor.
 * Always returns exactly N points — missing days have has_data: false.
 * Response: TrendResponse
 */
export async function GET(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10), 2), 30)

  // Build date range — today and N-1 days back
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }

  const startDate = dates[0]
  const endDate   = dates[dates.length - 1]

  const { data: rows, error } = await sb()
    .from('daily_summaries')
    .select('date, net_profit, total_expense, total_revenue')
    .eq('vendor_id', vendorId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) {
    console.error('[trend] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build a lookup map from fetched rows
  const rowMap: Record<string, { net_profit: number; total_expense: number; total_revenue: number }> = {}
  for (const row of rows ?? []) {
    rowMap[row.date] = {
      net_profit:    row.net_profit    ?? 0,
      total_expense: row.total_expense ?? 0,
      total_revenue: row.total_revenue ?? 0,
    }
  }

  // Fill all N days — missing days get has_data: false
  const points = dates.map(date => {
    const r = rowMap[date]
    return {
      date,
      net_profit:    r ? r.net_profit    : 0,
      total_expense: r ? r.total_expense : 0,
      total_revenue: r ? r.total_revenue : 0,
      has_data: !!r,
    }
  })

  // Compute week total and trend direction
  const dataPoints = points.filter(p => p.has_data)
  const week_total = dataPoints.reduce((s, p) => s + p.net_profit, 0)

  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (dataPoints.length >= 4) {
    const half     = Math.floor(dataPoints.length / 2)
    const firstAvg = dataPoints.slice(0, half).reduce((s, p) => s + p.net_profit, 0) / half
    const lastAvg  = dataPoints.slice(-half).reduce((s, p) => s + p.net_profit, 0) / half
    if (lastAvg > firstAvg * 1.05) trend = 'up'
    else if (lastAvg < firstAvg * 0.95) trend = 'down'
  }

  return NextResponse.json({ points, week_total, trend })
}

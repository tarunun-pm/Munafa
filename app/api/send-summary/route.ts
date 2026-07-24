import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computePnL } from '@/lib/pnl'
import { generateHindiSummary } from '@/lib/claude'
import { sendWhatsAppMessage } from '@/lib/twilio'
import type { Transaction } from '@/types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/send-summary
 * Cron-triggered daily at 9 PM IST (15:30 UTC).
 * For every vendor with transactions today:
 *   1. Compute P&L
 *   2. Generate Hindi summary via Claude
 *   3. Upsert daily_summaries row
 *   4. Send WhatsApp via Twilio
 * Protected by x-cron-secret header.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret (skip check if CRON_SECRET not set — dev mode)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret')
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const startOfDay = `${today}T00:00:00.000Z`
  const endOfDay = `${today}T23:59:59.999Z`
  const supabase = sb()

  // Collect distinct vendor IDs with transactions today
  const { data: rows } = await supabase
    .from('transactions')
    .select('vendor_id')
    .gte('logged_at', startOfDay)
    .lte('logged_at', endOfDay)

  if (!rows?.length) {
    return NextResponse.json({ message: 'No transactions today', processed: 0 })
  }

  const vendorIds = Array.from(new Set(rows.map(r => r.vendor_id as string)))
  let processed = 0
  const errors: string[] = []

  for (const vendorId of vendorIds) {
    try {
      // Vendor info
      const { data: vendor } = await supabase
        .from('vendors')
        .select('phone, name, language')
        .eq('id', vendorId)
        .single()
      if (!vendor) continue

      // Today's transactions
      const { data: txRows } = await supabase
        .from('transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .gte('logged_at', startOfDay)
        .lte('logged_at', endOfDay)
      if (!txRows?.length) continue

      const pnl = computePnL(txRows as Transaction[])

      // Days tracked
      const { count: daysTracked } = await supabase
        .from('daily_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)

      // Hindi summary (fallback if Claude fails)
      let summaryText = `Aaj aapka munafa ₹${pnl.net_profit} raha. Bikri ₹${pnl.total_revenue}, kharcha ₹${pnl.total_expense}.`
      try {
        summaryText = await generateHindiSummary(pnl, daysTracked ?? 0)
      } catch (claudeErr) {
        console.warn('[send-summary] Claude failed, using fallback:', claudeErr)
      }

      // Upsert daily_summaries
      await supabase.from('daily_summaries').upsert(
        {
          vendor_id: vendorId,
          date: today,
          ...pnl,
          summary_text_hi: summaryText,
        },
        { onConflict: 'vendor_id,date' }
      )

      // Send WhatsApp
      try {
        await sendWhatsAppMessage(vendor.phone, summaryText)
        await supabase
          .from('daily_summaries')
          .update({ sent_at: new Date().toISOString() })
          .eq('vendor_id', vendorId)
          .eq('date', today)
      } catch (twilioErr) {
        const msg = `WhatsApp failed for ${vendorId}`
        console.error('[send-summary]', msg, twilioErr)
        errors.push(msg)
      }

      processed++
    } catch (err) {
      const msg = `Processing failed for vendor ${vendorId}`
      console.error('[send-summary]', msg, err)
      errors.push(msg)
    }
  }

  return NextResponse.json({
    message: 'Summary job complete',
    processed,
    total: vendorIds.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

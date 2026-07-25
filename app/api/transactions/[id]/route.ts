import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ItemUnit } from '@/types'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const VALID_UNITS: ItemUnit[] = ['kg', 'litre', 'piece', 'bundle']

/**
 * PATCH /api/transactions/[id]
 * Updates the unit (and derived unit_price) on a saved transaction.
 *
 * Body: { unit: ItemUnit }
 * Response: { success: true, unit_price: number | null }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { unit } = await req.json()

    if (!VALID_UNITS.includes(unit as ItemUnit)) {
      return NextResponse.json(
        { error: `Invalid unit. Must be one of: ${VALID_UNITS.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify the transaction belongs to this vendor
    const { data: tx, error: fetchErr } = await sb()
      .from('transactions')
      .select('id, vendor_id, quantity, total_amount')
      .eq('id', id)
      .eq('vendor_id', vendorId)
      .single()

    if (fetchErr || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Compute unit_price if quantity is known
    const unit_price =
      tx.quantity && tx.quantity > 0
        ? Math.round((tx.total_amount / tx.quantity) * 100) / 100
        : null

    const { error: updateErr } = await sb()
      .from('transactions')
      .update({ unit, unit_price })
      .eq('id', id)
      .eq('vendor_id', vendorId)

    if (updateErr) {
      console.error('[transactions/patch] update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, unit_price })
  } catch (err: unknown) {
    console.error('[transactions/patch] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

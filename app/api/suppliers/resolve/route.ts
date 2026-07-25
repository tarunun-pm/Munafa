import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/suppliers/resolve
 * Links a pending transaction to a supplier after user confirmation.
 *
 * Body:
 *   { transaction_id: string, supplier_id: string }
 *
 * Response:
 *   { success: true }
 */
export async function POST(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { transaction_id, supplier_id } = await req.json()

    if (!transaction_id || !supplier_id) {
      return NextResponse.json(
        { error: 'transaction_id and supplier_id are required' },
        { status: 400 }
      )
    }

    // Verify the transaction belongs to this vendor before updating
    const { data: tx, error: fetchErr } = await sb()
      .from('transactions')
      .select('id, vendor_id')
      .eq('id', transaction_id)
      .eq('vendor_id', vendorId)
      .single()

    if (fetchErr || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const { error: updateErr } = await sb()
      .from('transactions')
      .update({ supplier_id, is_resolved: true })
      .eq('id', transaction_id)
      .eq('vendor_id', vendorId)

    if (updateErr) {
      console.error('[suppliers/resolve] update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[suppliers/resolve] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

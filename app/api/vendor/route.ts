import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Creates an anon Supabase client (RLS disabled for demo). */
function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/vendor
 * Upserts a vendor record by phone number.
 * Sets munafa_vendor_id and munafa_vendor_name cookies on success.
 * Body: { phone, name, gender, dob, language }
 * Response: { vendor_id, name, language, success }
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, name, gender, dob, language } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    const { data, error } = await sb()
      .from('vendors')
      .upsert(
        {
          phone,
          name: name ?? null,
          gender: gender ?? null,
          dob: dob || null,
          language: language ?? 'en',
        },
        { onConflict: 'phone' }
      )
      .select('id, name, language')
      .single()

    if (error) {
      console.error('[vendor] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const res = NextResponse.json({
      vendor_id: data.id,
      name: data.name,
      language: data.language,
      success: true,
    })

    // Session cookie — 1 year, HttpOnly (not accessible from JS)
    res.cookies.set('munafa_vendor_id', data.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })

    // Name cookie — readable from JS for display purposes
    res.cookies.set('munafa_vendor_name', data.name ?? '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })

    return res
  } catch (err) {
    console.error('[vendor] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/vendor
 * Returns vendor profile for the current session.
 * Reads vendor_id from cookie.
 */
export async function GET(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await sb()
    .from('vendors')
    .select('id, name, phone, language, gender, dob')
    .eq('id', vendorId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/vendor
 * If query param ?action=delete_account is present, deletes all database records for this vendor
 * (price_history, transactions, daily_summaries, suppliers, custom items, vendors)
 * then clears session cookies.
 * Otherwise, performs a standard logout (clearing session cookies).
 */
export async function DELETE(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'delete_account' && vendorId) {
    const client = sb()
    try {
      // 1. Delete price_history
      await client.from('price_history').delete().eq('vendor_id', vendorId)
      // 2. Delete transactions
      await client.from('transactions').delete().eq('vendor_id', vendorId)
      // 3. Delete daily_summaries
      await client.from('daily_summaries').delete().eq('vendor_id', vendorId)
      // 4. Delete suppliers
      await client.from('suppliers').delete().eq('vendor_id', vendorId)
      // 5. Delete custom items (items created by this vendor)
      await client.from('items').delete().eq('vendor_id', vendorId)
      // 6. Delete vendor account
      await client.from('vendors').delete().eq('id', vendorId)
    } catch (err) {
      console.error('[vendor] error deleting account data:', err)
      return NextResponse.json({ error: 'Failed to delete account data' }, { status: 500 })
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.delete('munafa_vendor_id')
  res.cookies.delete('munafa_vendor_name')
  return res
}

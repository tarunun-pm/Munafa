import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/suppliers
 * Returns all suppliers for the current vendor session.
 */
export async function GET(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await sb()
    .from('suppliers')
    .select('id, name, phone, aliases, created_at')
    .eq('vendor_id', vendorId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[suppliers] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ suppliers: data ?? [] })
}

/**
 * POST /api/suppliers
 * Creates a new supplier for the current vendor.
 * Body: { name: string, phone?: string }
 */
export async function POST(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { name, phone } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const norm = name.toLowerCase().trim()

    const { data, error } = await sb()
      .from('suppliers')
      .insert({
        vendor_id: vendorId,
        name: name.trim(),
        phone: phone?.trim() || null,
        aliases: [norm],
      })
      .select('id, name, phone, aliases, created_at')
      .single()

    if (error) {
      console.error('[suppliers] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ supplier: data }, { status: 201 })
  } catch (err: unknown) {
    console.error('[suppliers] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

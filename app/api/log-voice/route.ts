import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { transcribeAudio } from '@/lib/whisper'
import { parseVoiceTranscript } from '@/lib/claude'
import type { ParsedEntry, Transaction } from '@/types'

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Fuzzy-matches an item name against the items table.
 * Checks: exact name → alias → substring match.
 * Input:  supabase client, vendorId, itemName from Claude parsing.
 * Output: item UUID if matched, null if no match.
 */
async function matchItem(
  supabase: SupabaseClient,
  vendorId: string,
  itemName: string
): Promise<string | null> {
  const norm = itemName.toLowerCase().trim()

  const { data: items } = await supabase
    .from('items')
    .select('id, name, aliases')
    .or(`vendor_id.is.null,vendor_id.eq.${vendorId}`)

  if (!items) return null

  for (const item of items) {
    if (item.name.toLowerCase() === norm) return item.id
    if (item.aliases?.some((a: string) => a.toLowerCase() === norm)) return item.id
    if (item.name.toLowerCase().includes(norm) || norm.includes(item.name.toLowerCase())) {
      return item.id
    }
  }
  return null
}

/**
 * Matches a supplier name against the suppliers table.
 * Creates a new supplier silently if no match found.
 * Input:  supabase client, vendorId, supplierName from Claude parsing.
 * Output: supplier UUID (existing or newly created), or null.
 */
async function matchOrCreateSupplier(
  supabase: SupabaseClient,
  vendorId: string,
  supplierName: string
): Promise<string | null> {
  const norm = supplierName.toLowerCase().trim()

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id, name, aliases')
    .eq('vendor_id', vendorId)

  if (existing) {
    for (const s of existing) {
      if (s.name.toLowerCase() === norm) return s.id
      if (s.aliases?.some((a: string) => a.toLowerCase() === norm)) return s.id
    }
  }

  // Create new supplier
  const { data: created } = await supabase
    .from('suppliers')
    .insert({ vendor_id: vendorId, name: supplierName, aliases: [norm] })
    .select('id')
    .single()

  return created?.id ?? null
}

/**
 * POST /api/log-voice
 * Core voice processing pipeline:
 *   Audio blob → Whisper → Claude parse → DB write → confirmation text
 *
 * FormData fields:
 *   audio — Blob (webm audio)
 */
export async function POST(req: NextRequest) {
  const vendorId = req.cookies.get('munafa_vendor_id')?.value
  if (!vendorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const audioBlob = formData.get('audio') as Blob | null
    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    // ── Step 1: Whisper transcription ──────────────────────
    let rawText: string
    try {
      rawText = await transcribeAudio(audioBlob, 'hi')
    } catch (err) {
      console.error('[log-voice] Whisper error:', err)
      return NextResponse.json({
        success: false,
        entries: [],
        confirmation_text:
          'Awaaz clear nahi aayi. Dobara boliye.',
      })
    }

    // ── Step 2: Claude parsing ──────────────────────────────
    let parseResult
    try {
      parseResult = await parseVoiceTranscript(rawText)
    } catch (err) {
      console.error('[log-voice] Claude error:', err)
      // Save raw text even on parse failure
      await sb().from('transactions').insert({
        vendor_id: vendorId,
        entry_type: 'expense',
        total_amount: 0,
        raw_voice_text: rawText,
        confidence: 0,
        is_resolved: false,
      })
      return NextResponse.json({
        success: false,
        entries: [],
        confirmation_text: 'Kuch samajh nahi aaya. Dobara bata sakte hain?',
      })
    }

    if (!parseResult?.entries?.length) {
      return NextResponse.json({
        success: false,
        entries: [],
        confirmation_text: 'Kuch samajh nahi aaya. Dobara bata sakte hain?',
      })
    }

    const supabase = sb()
    const saved: Transaction[] = []
    const unresolved: ParsedEntry[] = []

    // ── Steps 3-6: Match items, suppliers, write to DB ─────
    for (const entry of parseResult.entries) {
      const itemId = await matchItem(supabase, vendorId, entry.item_name)
      if (!itemId) unresolved.push(entry)

      const supplierId =
        entry.supplier_name
          ? await matchOrCreateSupplier(supabase, vendorId, entry.supplier_name)
          : null

      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          vendor_id: vendorId,
          entry_type: entry.entry_type,
          item_id: itemId,
          item_name_raw: entry.item_name,
          quantity: entry.quantity,
          unit: entry.unit,
          unit_price: entry.unit_price,
          total_amount: entry.total_price,
          supplier_id: supplierId,
          raw_voice_text: rawText,
          confidence: entry.confidence,
          is_resolved: itemId !== null,
        })
        .select()
        .single()

      if (txErr) {
        console.error('[log-voice] insert error:', txErr)
        continue
      }

      saved.push(tx as Transaction)

      // Price history for expense entries
      if (
        entry.entry_type === 'expense' &&
        itemId &&
        entry.unit_price &&
        entry.unit
      ) {
        await supabase.from('price_history').insert({
          vendor_id: vendorId,
          item_id: itemId,
          supplier_id: supplierId,
          date: new Date().toISOString().split('T')[0],
          price_per_unit: entry.unit_price,
          unit: entry.unit,
        })
      }
    }

    // ── Step 7: Build confirmation text ────────────────────
    const expenses = parseResult.entries.filter(e => e.entry_type === 'expense')
    const sales = parseResult.entries.filter(e => e.entry_type === 'sale')
    let confirmationText = 'Maine note kiya: '

    if (expenses.length > 0) {
      const list = expenses.map(e => `${e.item_name} ₹${e.total_price}`).join(', ')
      const total = expenses.reduce((s, e) => s + e.total_price, 0)
      confirmationText += `${list}. Aaj ka kharcha ₹${total}.`
    }
    if (sales.length > 0) {
      const total = sales.reduce((s, e) => s + e.total_price, 0)
      confirmationText += ` Bikri ₹${total} note ho gayi.`
    }

    return NextResponse.json({
      success: true,
      entries: saved,
      confirmation_text: confirmationText,
      unresolved_items: unresolved.length > 0 ? unresolved : undefined,
    })
  } catch (err) {
    console.error('[log-voice] unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        entries: [],
        confirmation_text: 'Kuch gadbad ho gayi. Dobara try karein.',
      },
      { status: 500 }
    )
  }
}

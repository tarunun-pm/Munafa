import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { parseVoiceTranscript } from '@/lib/claude'
import type { ParsedEntry, PendingSupplier, SupplierMatch, Transaction } from '@/types'

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
 * Jaro-Winkler string similarity. Returns 0.0 (no match) to 1.0 (exact).
 * Used to detect near-duplicate supplier names from voice transcription.
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  const len1 = s1.length, len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0.0
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0)
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)
  let matches = 0, transpositions = 0
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist)
    const end   = Math.min(i + matchDist + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = s2Matches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0.0
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  // Winkler prefix bonus (up to 4 chars)
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** Similarity threshold: above this → flag for user confirmation. */
const FUZZY_THRESHOLD = 0.60

/**
 * Resolves a supplier name from voice against the vendor's supplier list.
 *
 * Returns:
 *  - { supplierId: string, pending: null } — exact/alias match OR newly created
 *  - { supplierId: null,   pending: PendingSupplier } — fuzzy match found, needs user confirmation
 */
async function resolveSupplier(
  supabase: SupabaseClient,
  vendorId: string,
  supplierName: string,
  transactionId: string
): Promise<{ supplierId: string | null; pending: PendingSupplier | null }> {
  const norm = supplierName.toLowerCase().trim()

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id, name, phone, aliases')
    .eq('vendor_id', vendorId)

  if (existing && existing.length > 0) {
    // ── Phase 1: exact name or alias match ──
    for (const s of existing) {
      if (s.name.toLowerCase() === norm) return { supplierId: s.id, pending: null }
      if (s.aliases?.some((a: string) => a.toLowerCase() === norm))
        return { supplierId: s.id, pending: null }
    }

    // ── Phase 2: fuzzy match ──
    const fuzzyMatches: SupplierMatch[] = existing
      .map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone ?? null,
        similarity: jaroWinkler(norm, s.name.toLowerCase()),
      }))
      .filter(m => m.similarity >= FUZZY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3) // show at most 3 candidates

    if (fuzzyMatches.length > 0) {
      // Don't auto-create — ask the user
      return {
        supplierId: null,
        pending: { transaction_id: transactionId, parsed_name: supplierName, similar_matches: fuzzyMatches },
      }
    }
  }

  // ── Phase 3: no match at all — silently create new supplier ──
  const { data: created } = await supabase
    .from('suppliers')
    .insert({ vendor_id: vendorId, name: supplierName, phone: null, aliases: [norm] })
    .select('id')
    .single()

  return { supplierId: created?.id ?? null, pending: null }
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
    console.warn('[log-voice] No munafa_vendor_id cookie — returning 401')
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const formData = await req.formData()

    // ── Step 1: Read transcript from Web Speech API (browser-side) ──
    const rawText = (formData.get('transcript') as string | null)?.trim()
    console.log('[log-voice] vendor:', vendorId, '| transcript:', rawText?.slice(0, 80))
    if (!rawText) {
      return NextResponse.json({
        success: false,
        entries: [],
        confirmation_text: 'Kuch sunai nahi diya. Dobara boliye.',
      })
    }

    // ── Step 2: Claude parsing ──────────────────────────────
    let parseResult
    try {
      parseResult = await parseVoiceTranscript(rawText)
      console.log('[log-voice] Claude parsed entries:', parseResult?.entries?.length ?? 0)
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
      console.warn('[log-voice] Claude returned 0 entries for text:', rawText)
      return NextResponse.json({
        success: false,
        entries: [],
        confirmation_text: 'Kuch samajh nahi aaya. Dobara bata sakte hain?',
      })
    }

    const supabase = sb()
    const saved: Transaction[] = []
    const unresolved: ParsedEntry[] = []
    const pendingSuppliers: PendingSupplier[] = []

    // ── Steps 3-6: Match items, suppliers, write to DB ─────
    for (const entry of parseResult.entries) {
      const itemId = await matchItem(supabase, vendorId, entry.item_name)
      if (!itemId) unresolved.push(entry)

      // Insert transaction first (supplier_id may be null if pending confirmation)
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
          supplier_id: null, // set below if resolved
          raw_voice_text: rawText,
          confidence: entry.confidence,
          is_resolved: itemId !== null,
        })
        .select()
        .single()

      if (txErr || !tx) {
        console.error('[log-voice] insert error:', txErr)
        continue
      }

      saved.push(tx as Transaction)

      // Resolve supplier if mentioned
      if (entry.supplier_name) {
        const { supplierId, pending } = await resolveSupplier(
          supabase, vendorId, entry.supplier_name, tx.id
        )

        if (pending) {
          // Fuzzy match — user needs to confirm; transaction saved with supplier_id=null
          pendingSuppliers.push(pending)
        } else if (supplierId) {
          // Exact match or new creation — update transaction with resolved supplier
          await supabase
            .from('transactions')
            .update({ supplier_id: supplierId })
            .eq('id', tx.id)
          ;(tx as Transaction & { supplier_id: string | null }).supplier_id = supplierId
        }
      }

      // Price history for expense entries with a resolved supplier
      if (
        entry.entry_type === 'expense' &&
        itemId &&
        entry.unit_price &&
        entry.unit
      ) {
        const resolvedSupplierId = pendingSuppliers.some(p => p.transaction_id === tx.id)
          ? null
          : (tx as Transaction & { supplier_id: string | null }).supplier_id
        await supabase.from('price_history').insert({
          vendor_id: vendorId,
          item_id: itemId,
          supplier_id: resolvedSupplierId,
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
      pending_suppliers: pendingSuppliers.length > 0 ? pendingSuppliers : undefined,
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

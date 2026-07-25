'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PendingSupplier, SupplierMatch } from '@/types'

interface SupplierConfirmationSheetProps {
  /** The list of pending suppliers needing user resolution (one sheet per item). */
  pending: PendingSupplier[]
  /** Called when all pending suppliers are resolved. */
  onAllResolved: () => void
}

type SheetView = 'confirm' | 'manual'

/**
 * Bottom-sheet that guides the vendor through supplier deduplication.
 * Shows one pending supplier at a time. Offers:
 *   1. Pick an existing similar supplier
 *   2. Add as a brand-new supplier
 *   3. Import from phone contacts (Web Contacts API, Chrome Android only)
 *   4. Enter name + phone manually
 */
export default function SupplierConfirmationSheet({
  pending,
  onAllResolved,
}: SupplierConfirmationSheetProps) {
  const [index, setIndex]       = useState(0)
  const [view, setView]         = useState<SheetView>('confirm')
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [contactsSupported, setContactsSupported] = useState(false)

  const current = pending[index]

  useEffect(() => {
    // Web Contacts API only available on Android Chrome / Samsung Internet
    setContactsSupported(
      typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window
    )
  }, [])

  // Pre-fill manual name from what Claude heard
  useEffect(() => {
    if (view === 'manual') {
      setManualName(current?.parsed_name ?? '')
      setManualPhone('')
    }
  }, [view, current])

  /** Advance to the next pending item or call onAllResolved. */
  const advance = useCallback(() => {
    setError(null)
    setView('confirm')
    if (index + 1 >= pending.length) {
      onAllResolved()
    } else {
      setIndex(i => i + 1)
    }
  }, [index, pending.length, onAllResolved])

  /** Link the transaction to an existing supplier. */
  async function resolveWith(supplierId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suppliers/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: current.transaction_id, supplier_id: supplierId }),
      })
      if (!res.ok) throw new Error('Resolve failed')
      advance()
    } catch {
      setError('Kuch gadbad hui. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }

  /** Create a new supplier then link the transaction. */
  async function createAndResolve(name: string, phone?: string) {
    setLoading(true)
    setError(null)
    try {
      // 1. Create supplier
      const createRes = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone?.trim() || undefined }),
      })
      if (!createRes.ok) throw new Error('Create failed')
      const { supplier } = await createRes.json()

      // 2. Link to transaction
      const resolveRes = await fetch('/api/suppliers/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: current.transaction_id, supplier_id: supplier.id }),
      })
      if (!resolveRes.ok) throw new Error('Resolve failed')

      advance()
    } catch {
      setError('Supplier add nahi ho saka. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }

  /** Open the Web Contacts API picker. */
  async function pickFromContacts() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (!contacts?.length) return
      const contact = contacts[0]
      const name  = contact.name?.[0]  ?? ''
      const phone = contact.tel?.[0]   ?? ''
      setManualName(name)
      setManualPhone(phone)
      setView('manual')
    } catch {
      // User cancelled or API unavailable — fall through silently
    }
  }

  if (!current) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(15,61,46,0.55)', backdropFilter: 'blur(2px)' }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Supplier confirmation"
        className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto rounded-t-3xl px-5 pt-4 pb-10 anim-slide-up"
        style={{ background: '#FFFBF3', boxShadow: '0 -8px 48px rgba(15,61,46,0.18)' }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#D4C9B8' }} />

        {/* Progress dots */}
        {pending.length > 1 && (
          <div className="flex justify-center gap-1.5 mb-4">
            {pending.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  background: i === index ? '#0F3D2E' : '#D4C9B8',
                }}
              />
            ))}
          </div>
        )}

        {view === 'confirm' ? (
          <>
            {/* Header */}
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: '#F2A93B' }}>
                Supplier Confirm Karein
              </p>
              <h2 className="font-bold text-lg leading-snug" style={{ color: '#0F3D2E', fontFamily: 'var(--font-baloo)' }}>
                &ldquo;{current.parsed_name}&rdquo; kaun hai?
              </h2>
              <p className="text-xs mt-1" style={{ color: '#8A8272' }}>
                Aapne pehle inn suppliers ke saath kaam kiya hai:
              </p>
            </div>

            {/* Similar matches */}
            <div className="space-y-2 mb-4">
              {current.similar_matches.map((match: SupplierMatch) => (
                <button
                  key={match.id}
                  id={`supplier-match-${match.id}`}
                  onClick={() => resolveWith(match.id)}
                  disabled={loading}
                  className="w-full rounded-2xl px-4 py-3 flex items-center justify-between text-left transition-all active:scale-98"
                  style={{
                    background: 'white',
                    border: '1.5px solid #E8E0D0',
                    boxShadow: '0 2px 12px rgba(15,61,46,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: '#DDEDE5', color: '#0F3D2E' }}
                    >
                      {match.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1A2E24' }}>
                        {match.name}
                      </p>
                      {match.phone && (
                        <p className="text-xs" style={{ color: '#8A8272' }}>{match.phone}</p>
                      )}
                    </div>
                  </div>
                  {/* Similarity badge */}
                  <div
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: match.similarity >= 0.85 ? '#DDEDE5' : '#FFF3DC',
                      color:      match.similarity >= 0.85 ? '#0F6B43' : '#A0620A',
                    }}
                  >
                    {match.similarity >= 0.85 ? 'Close match' : 'Similar'}
                  </div>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#E8E0D0' }} />
              <span className="text-[11px] font-medium" style={{ color: '#B0A898' }}>Ya phir</span>
              <div className="flex-1 h-px" style={{ background: '#E8E0D0' }} />
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              {/* Add as new */}
              <button
                id="supplier-add-new"
                onClick={() => createAndResolve(current.parsed_name)}
                disabled={loading}
                className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-98"
                style={{ background: '#0F3D2E', color: 'white' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                &ldquo;{current.parsed_name}&rdquo; ko naya supplier add karo
              </button>

              {/* Import from contacts */}
              {contactsSupported && (
                <button
                  id="supplier-from-contacts"
                  onClick={pickFromContacts}
                  disabled={loading}
                  className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-sm transition-all active:scale-98"
                  style={{ background: '#EFF7F3', color: '#0F3D2E', border: '1.5px solid #C5DDD2' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.1 2.22 2 2 0 012.08.04h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.17 7.84a16 16 0 006 6l1.17-1.17a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
                  </svg>
                  Contacts se add karo
                </button>
              )}

              {/* Manual entry */}
              <button
                id="supplier-manual-entry"
                onClick={() => setView('manual')}
                disabled={loading}
                className="w-full rounded-2xl py-3 flex items-center justify-center gap-2 font-medium text-sm transition-all active:scale-98"
                style={{ color: '#6B7A72' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Manually enter karo
              </button>
            </div>
          </>
        ) : (
          /* Manual entry form */
          <>
            <button
              onClick={() => setView('confirm')}
              className="flex items-center gap-1.5 text-sm font-medium mb-5"
              style={{ color: '#6B7A72' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Wapas jao
            </button>

            <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: '#F2A93B' }}>
              Naya Supplier
            </p>
            <h2 className="font-bold text-lg mb-5" style={{ color: '#0F3D2E', fontFamily: 'var(--font-baloo)' }}>
              Supplier ki details baro
            </h2>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A5E55' }} htmlFor="supplier-name-input">
                  Naam *
                </label>
                <input
                  id="supplier-name-input"
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="e.g. Raju Kumar"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'white',
                    border: '1.5px solid #E8E0D0',
                    color: '#1A2E24',
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A5E55' }} htmlFor="supplier-phone-input">
                  Phone number (optional)
                </label>
                <input
                  id="supplier-phone-input"
                  type="tel"
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'white',
                    border: '1.5px solid #E8E0D0',
                    color: '#1A2E24',
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 mb-3">{error}</p>
            )}

            <button
              id="supplier-save-manual"
              onClick={() => createAndResolve(manualName, manualPhone)}
              disabled={loading || !manualName.trim()}
              className="w-full rounded-2xl py-3.5 font-bold text-sm transition-all active:scale-98 disabled:opacity-50"
              style={{ background: '#0F3D2E', color: 'white' }}
            >
              {loading ? 'Save ho raha hai…' : 'Supplier Save Karo'}
            </button>
          </>
        )}

        {error && view === 'confirm' && (
          <p className="text-xs text-red-600 mt-3 text-center">{error}</p>
        )}
      </div>
    </>
  )
}

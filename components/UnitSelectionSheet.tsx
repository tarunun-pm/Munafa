'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ItemUnit, PendingUnit } from '@/types'

interface UnitSelectionSheetProps {
  pending: PendingUnit[]
  onAllResolved: () => void
}

/** Display metadata for each selectable unit option. */
const UNIT_OPTIONS: {
  unit: ItemUnit
  label: string
  labelHi: string
  examples: string
  icon: string
}[] = [
  {
    unit: 'kg',
    label: 'Kilogram',
    labelHi: 'Kilo / Kilogram',
    examples: 'pao, aadha kilo, 2 kg…',
    icon: '⚖️',
  },
  {
    unit: 'gram',
    label: 'Gram',
    labelHi: 'Gram',
    examples: '100 gram, 250 gram, 500g…',
    icon: '🥄',
  },
  {
    unit: 'litre',
    label: 'Litre',
    labelHi: 'Litre',
    examples: 'aadha litre, 2 litre, 500ml…',
    icon: '🫙',
  },
  {
    unit: 'piece',
    label: 'Piece / Packet',
    labelHi: 'Piece / Packet',
    examples: 'nag, packet, dozen, 12 pcs…',
    icon: '📦',
  },
  {
    unit: 'bundle',
    label: 'Bundle / Gaththa',
    labelHi: 'Bundle / Gaththa',
    examples: 'gathri, gatta, bundle…',
    icon: '🌿',
  },
]

const ENTRY_COLORS = {
  expense:  { accent: '#1B5B45', bg: '#DDEDE5' },
  sale:     { accent: '#DB8F1F', bg: '#FCE8C4' },
  spoilage: { accent: '#C9563B', bg: '#FDE8E4' },
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/**
 * Bottom-sheet that asks the vendor to select a unit for entries where
 * Claude could not determine the measurement unit from voice.
 * Shows one pending entry at a time.
 */
export default function UnitSelectionSheet({ pending, onAllResolved }: UnitSelectionSheetProps) {
  const [index,   setIndex]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [manualQuantity, setManualQuantity] = useState<string>('')

  const current = pending[index]

  useEffect(() => {
    if (current) {
      setManualQuantity(current.quantity ? String(current.quantity) : '')
    }
  }, [current])

  const advance = useCallback(() => {
    setError(null)
    if (index + 1 >= pending.length) {
      onAllResolved()
    } else {
      setIndex(i => i + 1)
    }
  }, [index, pending.length, onAllResolved])

  async function selectUnit(unit: ItemUnit) {
    setLoading(true)
    setError(null)
    try {
      const parsedQuantity = manualQuantity.trim() !== '' ? parseFloat(manualQuantity) : current.quantity
      const res = await fetch(`/api/transactions/${current.transaction_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit, quantity: parsedQuantity }),
      })
      if (!res.ok) throw new Error('Update failed')
      advance()
    } catch {
      setError('Unit save nahi ho saka. Dobara try karein.')
    } finally {
      setLoading(false)
    }
  }

  async function skipUnit() {
    advance() // Save as-is with null unit
  }

  if (!current) return null

  const colors = ENTRY_COLORS[current.entry_type] ?? ENTRY_COLORS.expense
  const isExpense = current.entry_type === 'expense'

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
        aria-label="Select unit"
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

        {/* Header */}
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: '#F2A93B' }}>
            Unit Batao
          </p>
          <h2 className="font-bold text-lg leading-snug" style={{ color: '#0F3D2E', fontFamily: 'var(--font-baloo)' }}>
            &ldquo;{current.item_name}&rdquo; ka unit kya hai?
          </h2>

          {/* Entry summary pill */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5"
              style={{ background: colors.bg }}
            >
              <span className="text-xs font-bold" style={{ color: colors.accent }}>
                {isExpense ? 'Kharcha' : 'Kamai'}
              </span>
              <span className="text-sm font-bold" style={{ color: colors.accent }}>
                {fmt(current.total_amount)}
              </span>
              {current.quantity !== null && (
                <span className="text-xs" style={{ color: colors.accent }}>
                  · {current.quantity} ?
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: '#8A8272' }}>
              Unit pata nahi chala
            </p>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="mb-4">
          <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A5E55' }} htmlFor="quantity-input">
            Sahi Quantity (agar galat hai ya empty hai)
          </label>
          <input
            id="quantity-input"
            type="number"
            step="any"
            value={manualQuantity}
            onChange={e => setManualQuantity(e.target.value)}
            placeholder="e.g. 5"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: 'white',
              border: '1.5px solid #E8E0D0',
              color: '#1A2E24',
            }}
          />
        </div>

        {/* Unit option grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {UNIT_OPTIONS.map(opt => (
            <button
              key={opt.unit}
              id={`unit-select-${opt.unit}`}
              onClick={() => selectUnit(opt.unit)}
              disabled={loading}
              className="rounded-2xl p-4 text-left transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'white',
                border: '1.5px solid #E8E0D0',
                boxShadow: '0 2px 12px rgba(15,61,46,0.05)',
              }}
            >
              <span className="text-2xl block mb-2">{opt.icon}</span>
              <p className="font-bold text-sm" style={{ color: '#0F3D2E' }}>
                {opt.labelHi}
              </p>
              <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: '#8A8272' }}>
                {opt.examples}
              </p>
              {/* Show derived unit_price if quantity is known */}
              {(() => {
                const q = manualQuantity.trim() !== '' ? parseFloat(manualQuantity) : current.quantity;
                if (q && q > 0) {
                  return (
                    <p
                      className="text-[11px] font-semibold mt-2 pt-2"
                      style={{ color: colors.accent, borderTop: `1px solid ${colors.bg}` }}
                    >
                      = {fmt(current.total_amount / q)} / {opt.unit}
                    </p>
                  );
                }
                return null;
              })()}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-600 mb-3 text-center">{error}</p>
        )}

        {/* Skip option */}
        <button
          id="unit-skip"
          onClick={skipUnit}
          disabled={loading}
          className="w-full py-3 text-sm font-medium transition-all"
          style={{ color: '#B0A898' }}
        >
          Abhi skip karo (baad mein add karein)
        </button>
      </div>
    </>
  )
}

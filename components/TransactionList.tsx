'use client'

import type { Transaction } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
}

const ICONS: Record<string, string> = {
  expense: '🛒',
  sale: '💰',
  spoilage: '🍂',
}

const LABELS: Record<string, string> = {
  expense: 'Kharcha',
  sale: 'Kamai',
  spoilage: 'Loss',
}

const COLORS: Record<string, { bg: string; text: string }> = {
  expense:  { bg: '#DDEDE5', text: '#1B5B45' },
  sale:     { bg: '#FCE8C4', text: '#DB8F1F' },
  spoilage: { bg: '#FDE8E4', text: '#C9563B' },
}

/**
 * TransactionList — scrollable list of today's voice-logged entries.
 * Shows item name, time, quantity, amount, and entry-type badge.
 */
export default function TransactionList({ transactions }: TransactionListProps) {
  if (!transactions.length) return null

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const c = COLORS[tx.entry_type] ?? COLORS.expense
        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 p-3 rounded-xl anim-fade-up"
            style={{ background: 'white', border: '1px solid #EFE4CC' }}
          >
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: c.bg }}
            >
              {ICONS[tx.entry_type]}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-charcoal-800 text-sm truncate capitalize">
                {tx.item_name_raw ?? 'Unknown item'}
              </p>
              <p className="text-xs text-muted-500 mt-0.5">
                {formatTime(tx.logged_at)}
                {tx.quantity && tx.unit ? ` · ${tx.quantity} ${tx.unit}` : ''}
              </p>
            </div>

            {/* Amount + badge */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <p className="font-bold text-charcoal-800 text-sm tabular-nums">
                ₹{tx.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: c.bg, color: c.text }}
              >
                {LABELS[tx.entry_type]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

'use client'

import type { PnLSummary } from '@/types'

interface PnLCardProps {
  summary: PnLSummary | null
  isLoading?: boolean
}

/** Formats a number as an Indian rupee string. */
function fmt(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/**
 * PnLCard — today's profit summary card.
 * Shows Kharcha (expense), Kamai (revenue), and Munafa (profit).
 */
export default function PnLCard({ summary, isLoading }: PnLCardProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl shimmer"
        style={{ background: 'white', height: 130, boxShadow: '0 4px 24px rgba(15,61,46,0.1)' }}
      />
    )
  }

  const profit     = summary?.net_profit ?? 0
  const isPositive = profit >= 0

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'white',
        boxShadow: '0 4px 28px rgba(15,61,46,0.1), 0 1px 4px rgba(15,61,46,0.06)',
      }}
    >
      {/* Card title */}
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500 mb-4">
        Today&apos;s Munafa
      </p>

      {/* Three metric chips */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <MetricChip
          label="Kharcha"
          value={summary ? fmt(summary.total_expense) : '₹0'}
          accent="#1B5B45"
          bg="#DDEDE5"
          icon={<ArrowDown />}
        />
        <MetricChip
          label="Kamai"
          value={summary ? fmt(summary.total_revenue) : '₹0'}
          accent="#2C7A5E"
          bg="#DDEDE5"
          icon={<ArrowUp />}
        />
        <MetricChip
          label="Munafa"
          value={summary ? fmt(Math.abs(profit)) : '₹0'}
          accent={isPositive ? '#2C7A5E' : '#2A2622'}
          bg={isPositive ? '#DDEDE5' : '#EFE4CC'}
          icon={isPositive ? <ArrowUp /> : <Minus />}
          highlight
        />
      </div>

      {/* Margin progress bar */}
      {summary && summary.total_revenue > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-500">Profit margin</span>
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: isPositive ? '#2C7A5E' : '#8A8272' }}
            >
              {Math.round(summary.margin_pct)}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden bg-sand-200">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(0, Math.min(100, summary.margin_pct))}%`,
                background: isPositive ? '#2C7A5E' : '#8A8272',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MetricChip({
  label, value, accent, bg, icon, highlight,
}: {
  label: string
  value: string
  accent: string
  bg: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: bg }}>
      <div className="flex items-center gap-1">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[10px] text-muted-500 font-medium">{label}</span>
      </div>
      <p
        className="font-bold text-sm tabular-nums leading-none"
        style={{ color: highlight ? accent : accent }}
      >
        {value}
      </p>
    </div>
  )
}

const ArrowDown = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 2v6m0 0L2 5m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ArrowUp = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 8V2m0 0L2 5m3-3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Minus = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

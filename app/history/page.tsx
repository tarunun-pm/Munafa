'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import type { DailySummary, Transaction } from '@/types'

/* ────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────── */

function formatDate(d: string): string {
  const date = new Date(d + 'T12:00:00')
  const today    = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)

  const isToday = date.toDateString() === today.toDateString()
  const isYest  = date.toDateString() === yesterday.toDateString()

  if (isToday)     return 'Today'
  if (isYest)      return 'Yesterday'

  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function fmt(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const ENTRY_ICONS: Record<string, string> = {
  expense:  '🛒',
  sale:     '💰',
  spoilage: '🍂',
}
const ENTRY_LABELS: Record<string, string> = {
  expense:  'Kharcha',
  sale:     'Kamai',
  spoilage: 'Loss',
}
const ENTRY_COLORS: Record<string, { bg: string; text: string }> = {
  expense:  { bg: '#DDEDE5', text: '#1B5B45' },
  sale:     { bg: '#FCE8C4', text: '#DB8F1F' },
  spoilage: { bg: '#FDE8E4', text: '#C9563B' },
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */

export default function HistoryPage() {
  const router = useRouter()

  const [summaries,   setSummaries]   = useState<DailySummary[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [expandedTx,  setExpandedTx]  = useState<Transaction[]>([])
  const [txLoading,   setTxLoading]   = useState(false)

  useEffect(() => { loadHistory() }, [])

  /* ── Load all daily summaries ── */
  async function loadHistory() {
    try {
      const vendorRes = await fetch('/api/vendor')
      if (!vendorRes.ok) { router.push('/onboarding'); return }
      const vendor = await vendorRes.json()

      // Fetch summaries via get-summary?date loop won't scale —
      // instead call Supabase directly through our vendor API pattern
      // We reuse get-summary without a date to get the last 60 days via a
      // dedicated endpoint. For now we use the history approach: call
      // get-summary for each date stored in daily_summaries via vendor id.
      // Since we don't have a dedicated history API route, we rely on
      // the fact that get-summary stores & returns daily_summaries.
      // We build a lightweight history list from the vendor response.

      // ── Fetch the last 60 days of summaries ──────────────────────────
      // We call a helper we define inline using the supabase anon client
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data } = await sb
        .from('daily_summaries')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('date', { ascending: false })
        .limit(60)

      setSummaries((data as DailySummary[]) ?? [])
    } catch (e) {
      console.error('[history] load failed', e)
    } finally {
      setIsLoading(false)
    }
  }

  /* ── Expand / collapse a row ── */
  async function toggleRow(s: DailySummary) {
    if (expanded === s.id) {
      setExpanded(null)
      setExpandedTx([])
      return
    }
    setExpanded(s.id)
    setTxLoading(true)
    try {
      const r = await fetch(`/api/get-summary?date=${s.date}`)
      if (r.ok) {
        const payload = await r.json()
        setExpandedTx(payload.transactions ?? [])
      }
    } catch {
      setExpandedTx([])
    } finally {
      setTxLoading(false)
    }
  }

  /* ── Compute aggregate stats across all loaded summaries ── */
  const totalProfit   = summaries.reduce((s, d) => s + d.net_profit, 0)
  const avgMargin     = summaries.length
    ? summaries.reduce((s, d) => s + d.margin_pct, 0) / summaries.length
    : 0
  const profitableDays = summaries.filter(d => d.net_profit > 0).length

  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-cream-50 max-w-[480px] mx-auto">

      {/* ─── Dark green header ─── */}
      <header
        className="px-5 pt-safe"
        style={{
          background: 'linear-gradient(155deg, #0F3D2E 0%, #1B5B45 100%)',
          paddingBottom: 28,
        }}
      >
        <div className="flex items-center gap-3 pt-4">
          {/* Back button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            aria-label="Back to dashboard"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-baloo)' }}
            >
              History
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Your daily profit log
            </p>
          </div>
        </div>

        {/* ── Aggregate stat chips ── */}
        {!isLoading && summaries.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-5">
            <StatChip
              label="Total Munafa"
              value={fmt(totalProfit)}
              positive={totalProfit >= 0}
            />
            <StatChip
              label="Avg Margin"
              value={`${Math.round(avgMargin)}%`}
              positive={avgMargin >= 0}
            />
            <StatChip
              label="Profit Days"
              value={`${profitableDays}/${summaries.length}`}
              positive
            />
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <div className="px-4 pt-5 space-y-2.5 pb-32">

        {/* Loading skeletons */}
        {isLoading && (
          [...Array(7)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl shimmer"
              style={{ background: 'white', height: 80 }}
            />
          ))
        )}

        {/* Empty state */}
        {!isLoading && summaries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
              style={{ background: '#DDEDE5' }}
            >
              📊
            </div>
            <h2 className="font-bold text-charcoal-800 text-lg mb-1">
              No history yet
            </h2>
            <p className="text-sm text-muted-500 max-w-[220px] leading-relaxed">
              Your daily P&L will appear here once you start logging on the dashboard.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)',
                color: '#0F3D2E',
              }}
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Summary rows */}
        {summaries.map((s) => {
          const isExp      = expanded === s.id
          const isPositive = s.net_profit >= 0

          return (
            <div key={s.id} className="anim-fade-up">
              {/* ── Row header (tappable) ── */}
              <button
                onClick={() => toggleRow(s)}
                className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{
                  background: 'white',
                  border: isExp
                    ? '1.5px solid #F2A93B'
                    : '1px solid #EFE4CC',
                  boxShadow: isExp
                    ? '0 4px 24px rgba(242,169,59,0.15)'
                    : '0 1px 6px rgba(0,0,0,0.04)',
                  borderRadius: isExp ? '16px 16px 0 0' : 16,
                  transition: 'border-color 0.2s, box-shadow 0.2s, border-radius 0.2s',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-charcoal-800 text-sm">
                      {formatDate(s.date)}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-500">
                        Kharcha {fmt(s.total_expense)}
                      </span>
                      <span className="text-muted-500 text-xs">·</span>
                      <span className="text-xs text-muted-500">
                        Kamai {fmt(s.total_revenue)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <div className="text-right">
                      <p
                        className="font-bold text-base tabular-nums"
                        style={{ color: isPositive ? '#2C7A5E' : '#C9563B' }}
                      >
                        {isPositive ? '+' : '−'}{fmt(s.net_profit)}
                      </p>
                      <p
                        className="text-[10px] font-medium"
                        style={{ color: isPositive ? '#2C7A5E' : '#8A8272' }}
                      >
                        {isPositive ? 'Profit' : 'Loss'} · {Math.round(s.margin_pct)}%
                      </p>
                    </div>
                    {/* Chevron */}
                    <div
                      style={{
                        transform: isExp ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.25s ease',
                        color: '#8A8272',
                      }}
                    >
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Margin progress bar */}
                {s.total_revenue > 0 && (
                  <div className="mt-3">
                    <div className="h-1 rounded-full overflow-hidden bg-sand-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, s.margin_pct))}%`,
                          background: isPositive ? '#2C7A5E' : '#8A8272',
                          transition: 'width 0.6s ease-out',
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>

              {/* ── Expanded content ── */}
              {isExp && (
                <div
                  className="rounded-b-2xl overflow-hidden"
                  style={{
                    border: '1.5px solid #F2A93B',
                    borderTop: 'none',
                    background: '#FFFBF3',
                  }}
                >
                  {/* Loading state */}
                  {txLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-ink-green-500/30 border-t-ink-green-500 anim-spin-arc"
                      />
                    </div>
                  )}

                  {/* Transactions */}
                  {!txLoading && expandedTx.length > 0 && (
                    <div className="divide-y divide-sand-200">
                      {expandedTx.map(tx => {
                        const c = ENTRY_COLORS[tx.entry_type] ?? ENTRY_COLORS.expense
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: c.bg }}
                            >
                              {ENTRY_ICONS[tx.entry_type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal-800 truncate capitalize">
                                {tx.item_name_raw ?? 'Unknown item'}
                              </p>
                              {tx.quantity && tx.unit && (
                                <p className="text-[11px] text-muted-500">
                                  {tx.quantity} {tx.unit}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                              <p className="text-sm font-bold text-charcoal-800 tabular-nums">
                                {fmt(tx.total_amount)}
                              </p>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: c.bg, color: c.text }}
                              >
                                {ENTRY_LABELS[tx.entry_type]}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* No transactions */}
                  {!txLoading && expandedTx.length === 0 && (
                    <p className="text-sm text-muted-500 text-center py-6">
                      No transactions found for this day.
                    </p>
                  )}

                  {/* WhatsApp AI summary */}
                  {!txLoading && s.summary_text_hi && (
                    <div
                      className="mx-4 mb-4 mt-2 rounded-xl px-4 py-3"
                      style={{ background: '#0F3D2E' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">💬</span>
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: '#F2A93B' }}
                        >
                          Munafa Summary
                        </p>
                      </div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.88)' }}
                      >
                        {s.summary_text_hi}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Bottom Nav ─── */}
      <BottomNav
        activeTab="history"
        onTabChange={t => {
          if (t === 'home')      router.push('/dashboard')
          if (t === 'catalogue') router.push('/catalogue')
        }}
      />
    </div>
  )
}

/* ────────────────────────────────────────────────
   Stat Chip sub-component
──────────────────────────────────────────────── */

function StatChip({
  label, value, positive,
}: {
  label: string
  value: string
  positive: boolean
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.1)' }}
    >
      <p
        className="text-[10px] font-medium mb-0.5"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        {label}
      </p>
      <p
        className="font-bold text-sm tabular-nums"
        style={{ color: positive ? '#F2A93B' : 'rgba(255,255,255,0.75)' }}
      >
        {value}
      </p>
    </div>
  )
}

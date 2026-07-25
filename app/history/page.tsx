'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import ProfileModal from '@/components/ProfileModal'
import type { Transaction } from '@/types'

/* ────────────────────────────────────────────────
   Types
──────────────────────────────────────────────── */

interface DateGroup {
  date: string
  transactions: Transaction[]
  total_expense: number
  total_revenue: number
  net_profit: number
  summary_text_hi: string | null
}

interface HistoryResponse {
  groups: DateGroup[]
  total: number
  page: number
  totalPages: number
  limit: number
}

/* ────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────── */

function formatDate(d: string): string {
  const date      = new Date(d + 'T12:00:00')
  const today     = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString())     return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function fmt(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const ENTRY_ICONS: Record<string, string>  = { expense: '🛒', sale: '💰', spoilage: '🍂' }
const ENTRY_LABELS: Record<string, string> = { expense: 'Kharcha', sale: 'Kamai', spoilage: 'Loss' }
const ENTRY_COLORS: Record<string, { bg: string; text: string }> = {
  expense:  { bg: '#DDEDE5', text: '#1B5B45' },
  sale:     { bg: '#FCE8C4', text: '#DB8F1F' },
  spoilage: { bg: '#FDE8E4', text: '#C9563B' },
}

const PAGE_SIZE = 10

/* ════════════════════════════════════════════════
   MAIN COMPONENT (wrapped in Suspense for useSearchParams)
════════════════════════════════════════════════ */

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryPageInner />
    </Suspense>
  )
}

function HistoryPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const initialPage  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  const [groups,       setGroups]       = useState<DateGroup[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [page,         setPage]         = useState(initialPage)
  const [totalPages,   setTotalPages]   = useState(1)
  const [total,        setTotal]        = useState(0)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  /* ── Load a page of history ── */
  const loadPage = useCallback(async (p: number) => {
    setIsLoading(true)
    setError(null)
    try {
      // Auth check
      const vendorRes = await fetch('/api/vendor')
      if (!vendorRes.ok) { router.push('/onboarding'); return }

      const res = await fetch(`/api/history?page=${p}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error('Failed to load history')
      const data: HistoryResponse = await res.json()

      setGroups(data.groups)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(data.page)
      setExpanded(null) // collapse on page change
    } catch (e) {
      console.error('[history] load failed', e)
      setError('History load nahi ho saki. Dobara try karein.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => { loadPage(initialPage) }, [loadPage, initialPage])

  /* ── Summary totals across current page ── */
  const totalProfit    = groups.reduce((s, g) => s + g.net_profit, 0)
  const profitableDays = groups.filter(g => g.net_profit > 0).length
  const avgMargin      = groups.length
    ? groups.reduce((s, g) => {
        const margin = g.total_revenue > 0 ? ((g.net_profit / g.total_revenue) * 100) : 0
        return s + margin
      }, 0) / groups.length
    : 0

  return (
    <div className="min-h-screen max-w-[480px] mx-auto" style={{ backgroundColor: '#FFFBF3' }}>

      {/* ─── Dark green header ─── */}
      <header
        className="px-5 pt-safe"
        style={{
          background: 'linear-gradient(155deg, #0F3D2E 0%, #1B5B45 100%)',
          paddingBottom: 28,
        }}
      >
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              aria-label="Back to dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5m7-7-7 7 7 7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-baloo)' }}>
                History
              </h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {total > 0 ? `${total} din ka record` : 'Aapka daily profit log'}
              </p>
            </div>
          </div>

          {/* Settings */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            aria-label="Profile and Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="white" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Aggregate stat chips — only show when data loaded */}
        {!isLoading && groups.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-5">
            <StatChip label="Munafa" value={fmt(totalProfit)} positive={totalProfit >= 0} />
            <StatChip label="Avg Margin" value={`${Math.round(avgMargin)}%`} positive={avgMargin >= 0} />
            <StatChip label="Profit Days" value={`${profitableDays}/${groups.length}`} positive />
          </div>
        )}
      </header>

      {/* ─── Content ─── */}
      <div className="px-4 pt-5 pb-36 space-y-2.5">

        {/* Loading skeletons */}
        {isLoading && (
          [...Array(PAGE_SIZE)].map((_, i) => (
            <div key={i} className="rounded-2xl shimmer" style={{ background: 'white', height: 80 }} />
          ))
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex flex-col items-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: '#FDE8E4' }}>⚠️</div>
            <p className="text-sm font-medium text-charcoal-800">{error}</p>
            <button
              onClick={() => loadPage(page)}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: '#0F3D2E', color: 'white' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5" style={{ background: '#DDEDE5' }}>
              📊
            </div>
            <h2 className="font-bold text-charcoal-800 text-lg mb-1">No history yet</h2>
            <p className="text-sm text-muted-500 max-w-[220px] leading-relaxed">
              Aapka daily P&L yahan dikhega jab aap dashboard pe log karna shuru karein.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)', color: '#0F3D2E' }}
            >
              Dashboard pe jao →
            </button>
          </div>
        )}

        {/* Date groups */}
        {!isLoading && !error && groups.map((group) => (
          <DateGroupRow
            key={group.date}
            group={group}
            isExpanded={expanded === group.date}
            onToggle={() => setExpanded(prev => prev === group.date ? null : group.date)}
          />
        ))}

        {/* ─── Pagination ─── */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 pb-2">
            <button
              onClick={() => loadPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30"
              style={{ background: 'white', border: '1.5px solid #E8E0D0', color: '#0F3D2E' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Pehle
            </button>

            <span className="text-xs font-medium" style={{ color: '#8A8272' }}>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => loadPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-30"
              style={{ background: '#0F3D2E', color: 'white' }}
            >
              Aage
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
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
   Date Group Row
──────────────────────────────────────────────── */

function DateGroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: DateGroup
  isExpanded: boolean
  onToggle: () => void
}) {
  const isPositive = group.net_profit >= 0

  return (
    <div className="anim-fade-up">
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
        style={{
          background: 'white',
          border: isExpanded ? '1.5px solid #F2A93B' : '1px solid #EFE4CC',
          boxShadow: isExpanded ? '0 4px 24px rgba(242,169,59,0.15)' : '0 1px 6px rgba(0,0,0,0.04)',
          borderRadius: isExpanded ? '16px 16px 0 0' : 16,
          transition: 'border-color 0.2s, box-shadow 0.2s, border-radius 0.2s',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-charcoal-800 text-sm">{formatDate(group.date)}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-500">Kharcha {fmt(group.total_expense)}</span>
              <span className="text-muted-500 text-xs">·</span>
              <span className="text-xs text-muted-500">Kamai {fmt(group.total_revenue)}</span>
              <span className="text-muted-500 text-xs">·</span>
              <span className="text-xs text-muted-500">{group.transactions.length} entries</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <div className="text-right">
              <p className="font-bold text-base tabular-nums" style={{ color: isPositive ? '#2C7A5E' : '#C9563B' }}>
                {isPositive ? '+' : '−'}{fmt(group.net_profit)}
              </p>
              <p className="text-[10px] font-medium" style={{ color: isPositive ? '#2C7A5E' : '#8A8272' }}>
                {isPositive ? 'Profit' : 'Loss'}
              </p>
            </div>
            {/* Chevron */}
            <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease', color: '#8A8272' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Margin bar */}
        {group.total_revenue > 0 && (
          <div className="mt-3">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#F0EDE6' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, (group.net_profit / group.total_revenue) * 100))}%`,
                  background: isPositive ? '#2C7A5E' : '#8A8272',
                  transition: 'width 0.6s ease-out',
                }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Expanded transactions */}
      {isExpanded && (
        <div
          className="rounded-b-2xl overflow-hidden"
          style={{ border: '1.5px solid #F2A93B', borderTop: 'none', background: '#FFFBF3' }}
        >
          {group.transactions.length > 0 ? (
            <div className="divide-y" style={{ borderColor: '#F0EDE6' }}>
              {group.transactions.map(tx => {
                const c = ENTRY_COLORS[tx.entry_type] ?? ENTRY_COLORS.expense
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
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
                        <p className="text-[11px] text-muted-500">{tx.quantity} {tx.unit}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <p className="text-sm font-bold text-charcoal-800 tabular-nums">{fmt(tx.total_amount)}</p>
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
          ) : (
            <p className="text-sm text-muted-500 text-center py-6">No transactions for this day.</p>
          )}

          {/* AI summary */}
          {group.summary_text_hi && (
            <div className="mx-4 mb-4 mt-2 rounded-xl px-4 py-3" style={{ background: '#0F3D2E' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">💬</span>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#F2A93B' }}>
                  Munafa Summary
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {group.summary_text_hi}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   Stat Chip
──────────────────────────────────────────────── */

function StatChip({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <p className="text-[10px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <p className="font-bold text-sm tabular-nums" style={{ color: positive ? '#F2A93B' : 'rgba(255,255,255,0.75)' }}>
        {value}
      </p>
    </div>
  )
}

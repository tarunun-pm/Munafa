'use client'

import { useState, useEffect, useRef } from 'react'
import type { TrendPoint, TrendResponse } from '@/types'

/* ─── helpers ─────────────────────────────────────────── */

function fmt(n: number): string {
  const abs = Math.abs(n)
  return `₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' })
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/* ─── SVG sparkline ───────────────────────────────────── */

const W        = 320   // viewBox width
const H        = 80    // viewBox height
const PAD_X    = 12    // horizontal padding inside viewBox
const PAD_TOP  = 10    // top padding
const PAD_BOT  = 6     // bottom padding (above day labels)

interface SparkProps {
  points: TrendPoint[]
  onHover: (idx: number | null) => void
  hoveredIdx: number | null
}

function Sparkline({ points, onHover, hoveredIdx }: SparkProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const profits = points.map(p => p.net_profit)
  const min     = Math.min(...profits, 0)
  const max     = Math.max(...profits, 1)
  const range   = max - min || 1

  // Map a profit value → Y coordinate (inverted: high profit = low Y)
  function toY(v: number) {
    return PAD_TOP + (1 - (v - min) / range) * (H - PAD_TOP - PAD_BOT)
  }

  const n    = points.length
  const step = (W - PAD_X * 2) / (n - 1)

  function toX(i: number) {
    return PAD_X + i * step
  }

  // Build the polyline path string
  const coordStr = points
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.net_profit).toFixed(1)}`)
    .join(' ')

  // Area path: line + close to bottom
  const areaD =
    `M ${toX(0).toFixed(1)},${toY(points[0].net_profit).toFixed(1)} ` +
    points
      .slice(1)
      .map((p, i) => `L ${toX(i + 1).toFixed(1)},${toY(p.net_profit).toFixed(1)}`)
      .join(' ') +
    ` L ${toX(n - 1).toFixed(1)},${H - PAD_BOT} L ${toX(0).toFixed(1)},${H - PAD_BOT} Z`

  // Zero line Y
  const zeroY = toY(0)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX  = ((e.clientX - rect.left) / rect.width) * W
    const idx   = Math.round((relX - PAD_X) / step)
    onHover(Math.max(0, Math.min(n - 1, idx)))
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    e.preventDefault()
    const rect   = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX   = ((e.touches[0].clientX - rect.left) / rect.width) * W
    const idx    = Math.round((relX - PAD_X) / step)
    onHover(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => onHover(null)}
    >
      <defs>
        {/* Green gradient for positive area */}
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#2C7A5E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2C7A5E" stopOpacity="0.02" />
        </linearGradient>
        {/* Amber gradient for negative dip */}
        <linearGradient id="trendGradNeg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F2A93B" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#F2A93B" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Zero baseline */}
      {min < 0 && (
        <line
          x1={PAD_X} y1={zeroY.toFixed(1)}
          x2={W - PAD_X} y2={zeroY.toFixed(1)}
          stroke="#EFE4CC" strokeWidth="1" strokeDasharray="4 3"
        />
      )}

      {/* Area fill */}
      <path d={areaD} fill="url(#trendGrad)" />

      {/* Main polyline */}
      <polyline
        points={coordStr}
        fill="none"
        stroke="#2C7A5E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => {
        const cx     = toX(i)
        const cy     = toY(p.net_profit)
        const isHov  = hoveredIdx === i
        const isPos  = p.net_profit >= 0
        const color  = !p.has_data ? '#D0C9BD' : isPos ? '#2C7A5E' : '#F2A93B'

        return (
          <g key={i}>
            {/* Hover highlight ring */}
            {isHov && (
              <circle
                cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="10"
                fill={color} fillOpacity="0.12"
              />
            )}
            {/* Dot */}
            <circle
              cx={cx.toFixed(1)} cy={cy.toFixed(1)}
              r={isHov ? 5 : 3.5}
              fill={p.has_data ? color : 'none'}
              stroke={color}
              strokeWidth={p.has_data ? 0 : 1.5}
              style={{ transition: 'r 0.15s ease' }}
            />
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Main card ───────────────────────────────────────── */

/**
 * ProfitTrendCard — 7-day net profit sparkline.
 * Fetches /api/trend on mount and renders an SVG area chart.
 * Shows loading shimmer, empty state, and tooltip on hover/tap.
 */
export default function ProfitTrendCard() {
  const [data, setData]           = useState<TrendResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/trend?days=7')
      .then(r => (r.ok ? r.json() : null))
      .then((json: TrendResponse | null) => {
        setData(json)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div
        className="rounded-2xl shimmer"
        style={{ background: 'white', height: 160, boxShadow: '0 4px 24px rgba(15,61,46,0.1)' }}
      />
    )
  }

  /* ── No data or not enough points ── */
  const filledPoints  = data?.points ?? []
  const daysWithData  = filledPoints.filter(p => p.has_data).length

  if (!data || daysWithData < 2) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-2"
        style={{
          background: 'white',
          boxShadow: '0 4px 28px rgba(15,61,46,0.08)',
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500 self-start mb-1">
          Munafa Trend
        </p>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: '#DDEDE5' }}
        >
          📈
        </div>
        <p className="font-semibold text-charcoal-800 text-sm">Trend abhi ban rahi hai</p>
        <p className="text-xs text-muted-500 text-center max-w-[220px]">
          2 din ka data aane par yahan aapka profit trend dikhega.
        </p>
      </div>
    )
  }

  /* ── Hovered point ── */
  const hovered = hoveredIdx !== null ? filledPoints[hoveredIdx] : null

  /* ── Week total display ── */
  const isWeekPos  = (data.week_total ?? 0) >= 0
  const trendIcon  = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'
  const trendColor = data.trend === 'up' ? '#2C7A5E' : data.trend === 'down' ? '#C9563B' : '#8A8272'

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'white',
        boxShadow: '0 4px 28px rgba(15,61,46,0.1), 0 1px 4px rgba(15,61,46,0.06)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500">
          Munafa Trend · 7 Din
        </p>
        <div className="flex items-center gap-1">
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{ color: isWeekPos ? '#2C7A5E' : '#C9563B' }}
          >
            {isWeekPos ? '+' : '−'}{fmt(data.week_total)}
          </span>
          <span className="text-xs font-bold" style={{ color: trendColor }}>
            {trendIcon}
          </span>
        </div>
      </div>

      {/* Tooltip strip — shows hovered day info */}
      <div
        className="mb-2 h-8 flex items-center"
        style={{ minHeight: 32 }}
      >
        {hovered ? (
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-xl anim-fade-up"
            style={{
              background: hovered.net_profit >= 0 ? '#DDEDE5' : '#FCE8C4',
            }}
          >
            <span className="text-xs text-muted-500">{shortDate(hovered.date)}</span>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: hovered.net_profit >= 0 ? '#1B5B45' : '#DB8F1F' }}
            >
              {hovered.has_data
                ? `${hovered.net_profit >= 0 ? '+' : '−'}${fmt(hovered.net_profit)}`
                : 'Koi entry nahi'}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-muted-500 pl-1">
            Kisi din pe tap karein
          </p>
        )}
      </div>

      {/* SVG chart */}
      <Sparkline
        points={filledPoints}
        onHover={setHoveredIdx}
        hoveredIdx={hoveredIdx}
      />

      {/* Day labels */}
      <div className="flex justify-between mt-1 px-3">
        {filledPoints.map((p, i) => (
          <span
            key={i}
            className="text-[9px] tabular-nums select-none"
            style={{
              color: hoveredIdx === i ? '#0F3D2E' : '#B0A898',
              fontWeight: hoveredIdx === i ? 700 : 400,
              transition: 'color 0.15s, font-weight 0.15s',
            }}
          >
            {shortDay(p.date)}
          </span>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import VoiceRecorder from '@/components/VoiceRecorder'
import PnLCard from '@/components/PnLCard'
import ProfitTrendCard from '@/components/ProfitTrendCard'
import TransactionList from '@/components/TransactionList'
import ConfirmationToast from '@/components/ConfirmationToast'
import BottomNav from '@/components/BottomNav'
import ProfileModal from '@/components/ProfileModal'
import type { GetSummaryResponse, VoiceRecorderState, LogVoiceResponse } from '@/types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Dashboard — main vendor screen.
 * Shows today's P&L, the voice recorder orb, and today's transaction list.
 */
export default function DashboardPage() {
  const router = useRouter()

  const [data, setData]             = useState<GetSummaryResponse | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [activeTab, setActiveTab]   = useState<'home' | 'history' | 'catalogue'>('home')
  const [toast, setToast]           = useState<string | null>(null)
  const [recorderState, setRecorderState] = useState<VoiceRecorderState>('idle')
  const [mounted, setMounted]       = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  /* ── Fetch today's summary ── */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/get-summary')
      if (res.status === 401) {
        router.push('/onboarding')
        return
      }
      if (!res.ok) throw new Error('fetch failed')
      const json: GetSummaryResponse = await res.json()
      setData(json)
    } catch {
      /* silent — keep stale data or show empty state */
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
    fetchSummary()
  }, [fetchSummary])

  /* ── After a successful voice log, refresh data + show toast ── */
  function handleVoiceComplete(result: LogVoiceResponse) {
    if (result.confirmation_text) {
      setToast(result.confirmation_text)
    }
    if (result.success) {
      fetchSummary()
    }
  }

  const isRecording = recorderState === 'recording'

  return (
    <div
      className="min-h-screen max-w-[480px] mx-auto flex flex-col"
      style={{ backgroundColor: '#FFFBF3' }}
    >
      {/* ── Header ── */}
      <header
        className="pt-safe px-5 pb-5 relative overflow-hidden"
        style={{ backgroundColor: '#0F3D2E' }}
      >
        {/* Subtle top glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(242,169,59,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="relative pt-4 flex items-start justify-between">
          {/* Brand + greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)',
                  color: '#0F3D2E',
                }}
              >
                ₹
              </div>
              <span
                className="text-white font-bold text-lg tracking-tight"
                style={{ fontFamily: 'var(--font-baloo)' }}
              >
                Munafa
              </span>
            </div>
            <p
              className="font-bold text-[22px] leading-tight text-white h-7"
              style={{ fontFamily: 'var(--font-baloo)' }}
            >
              {mounted ? `${getGreeting()} 👋` : ''}
            </p>
            <p className="text-xs mt-0.5 h-4" style={{ color: 'rgba(255,255,255,0.42)' }}>
              {mounted ? formatDate() : ''}
            </p>
          </div>

          {/* Settings icon */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center mt-1 transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            aria-label="Profile and Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Scrollable body ── */}
      <main
        className="flex-1 overflow-y-auto scrollbar-none pb-32"
        style={{ paddingBottom: '7rem' }}
      >
        {activeTab === 'home' ? (
          <HomeTab
            data={data}
            isLoading={isLoading}
            recorderState={recorderState}
            onStateChange={setRecorderState}
            onVoiceComplete={handleVoiceComplete}
            isRecording={isRecording}
          />
        ) : (
          <HistoryTab data={data} />
        )}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <ConfirmationToast
          text={toast}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* ── Profile & Settings Modal ── */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* ── Bottom nav ── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={t => {
          setActiveTab(t as 'home' | 'history' | 'catalogue')
          if (t === 'history')   router.push('/history')
          if (t === 'catalogue') router.push('/catalogue')
        }}
      />
    </div>
  )
}

/* ── Home Tab ─────────────────────────────────────────── */
function HomeTab({
  data,
  isLoading,
  recorderState,
  onStateChange,
  onVoiceComplete,
  isRecording,
}: {
  data: GetSummaryResponse | null
  isLoading: boolean
  recorderState: VoiceRecorderState
  onStateChange: (s: VoiceRecorderState) => void
  onVoiceComplete: (r: LogVoiceResponse) => void
  isRecording: boolean
}) {
  return (
    <div className="px-4 pt-5 space-y-5">
      {/* P&L card */}
      <div className="anim-fade-up">
        <PnLCard summary={data?.summary ?? null} isLoading={isLoading} />
      </div>

      {/* 7-day profit trend */}
      <div className="anim-fade-up">
        <ProfitTrendCard />
      </div>

      {/* Voice recorder orb section */}
      <div
        className="rounded-2xl py-8 flex flex-col items-center gap-2"
        style={{
          background: 'white',
          boxShadow: '0 4px 28px rgba(15,61,46,0.08), 0 1px 4px rgba(15,61,46,0.05)',
        }}
      >
        {/* Section label */}
        {!isRecording && (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500 mb-4 anim-fade-up"
          >
            Voice Log
          </p>
        )}

        <VoiceRecorder
          onStateChange={onStateChange}
          onComplete={onVoiceComplete}
        />

        {/* Hint text when idle */}
        {recorderState === 'idle' && (
          <p
            className="text-xs text-center mt-3 px-8 anim-fade-up"
            style={{ color: '#8A8272' }}
          >
            Say something like{' '}
            <em className="not-italic font-semibold text-ink-green-700">
              &ldquo;Sold 5 kg tomatoes for ₹200&rdquo;
            </em>
          </p>
        )}
      </div>

      {/* Today's transactions */}
      {data?.transactions && data.transactions.length > 0 && (
        <div className="anim-fade-up">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500 mb-3">
            Today&apos;s Entries
          </p>
          <TransactionList transactions={data.transactions} />
        </div>
      )}

      {/* Empty state — no transactions yet */}
      {!isLoading && (!data?.transactions || data.transactions.length === 0) && (
        <div
          className="rounded-2xl py-10 flex flex-col items-center gap-3 anim-fade-up"
          style={{
            background: 'white',
            boxShadow: '0 4px 28px rgba(15,61,46,0.06)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: '#DDEDE5' }}
          >
            🎙️
          </div>
          <div className="text-center px-6">
            <p className="font-bold text-charcoal-800 text-sm">No entries yet</p>
            <p className="text-xs text-muted-500 mt-1">
              Tap the mic and log your first sale or purchase!
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp summary CTA */}
      {data?.summary_text_hi && (
        <button
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-2.5 anim-fade-up"
          style={{
            background: '#25D366',
            boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
          }}
          onClick={() => {
            const msg = encodeURIComponent(data.summary_text_hi ?? '')
            window.open(`https://wa.me/?text=${msg}`, '_blank')
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span className="text-white font-bold text-sm">Send to WhatsApp</span>
        </button>
      )}
    </div>
  )
}

/* ── History Tab ──────────────────────────────────────── */
function HistoryTab({ data }: { data: GetSummaryResponse | null }) {
  if (!data?.transactions?.length) {
    return (
      <div className="px-4 pt-5">
        <div
          className="rounded-2xl py-12 flex flex-col items-center gap-3 anim-fade-up"
          style={{ background: 'white', boxShadow: '0 4px 28px rgba(15,61,46,0.06)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: '#EFE4CC' }}
          >
            📋
          </div>
          <div className="text-center px-6">
            <p className="font-bold text-charcoal-800 text-sm">No history yet</p>
            <p className="text-xs text-muted-500 mt-1">
              Your logged entries will appear here.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-500 mb-3">
        Today&apos;s Entries
      </p>
      <TransactionList transactions={data.transactions} />
    </div>
  )
}

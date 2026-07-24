'use client'

import type { VoiceRecorderState } from '@/types'

interface MicOrbProps {
  /** Current recorder state — drives visual appearance. */
  state: VoiceRecorderState
  /** Called when orb is tapped (only active in idle/recording states). */
  onPress: () => void
  /** Timer string shown during recording, e.g. "0:12". */
  timer?: string
  /** Diameter of the orb in px. Default 160. */
  size?: number
}

/**
 * MicOrb — the signature Munafa UI element.
 * Renders a circular button with state-driven colour, icon, and animation.
 */
export default function MicOrb({
  state,
  onPress,
  timer,
  size = 160,
}: MicOrbProps) {
  const isIdle       = state === 'idle'
  const isRecording  = state === 'recording'
  const isProcessing = state === 'processing'
  const isConfirmed  = state === 'confirmed'
  const isError      = state === 'error'

  const canTap = isIdle || isRecording

  /* Orb background colour per state */
  const orbBg = isRecording
    ? '#DB8F1F'   // turmeric-600 — intense while recording
    : isProcessing
    ? '#1B5B45'   // ink-green-700 — calm processing
    : isConfirmed
    ? '#2C7A5E'   // ink-green-500 — success
    : isError
    ? '#C9563B'   // alert-500
    : '#F2A93B'   // turmeric-500 — idle default

  const orbShadow = isIdle
    ? '0 0 48px rgba(242,169,59,0.32), 0 8px 32px rgba(15,61,46,0.22)'
    : isRecording
    ? '0 0 72px rgba(242,169,59,0.48), 0 8px 40px rgba(15,61,46,0.3)'
    : '0 8px 32px rgba(0,0,0,0.22)'

  const wrapSize = size * 1.6 // extra space for rings and glow

  return (
    <div className="flex flex-col items-center select-none" style={{ gap: 20 }}>
      {/* ── Ring + Orb wrapper ── */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: wrapSize, height: wrapSize }}
      >
        {/* Idle glow backdrop */}
        {isIdle && (
          <div
            className="absolute rounded-full orb-glow anim-orb-breathe pointer-events-none"
            style={{
              width: size + 56,
              height: size + 56,
              opacity: 0.16,
              filter: 'blur(10px)',
            }}
          />
        )}

        {/* Recording pulse rings */}
        {isRecording && (
          <>
            <div
              className="absolute rounded-full border-2 border-turmeric-500 anim-pulse-ring pointer-events-none"
              style={{ width: size + 24, height: size + 24 }}
            />
            <div
              className="absolute rounded-full border-2 border-turmeric-500 anim-pulse-ring-delayed pointer-events-none"
              style={{ width: size + 24, height: size + 24 }}
            />
          </>
        )}

        {/* Main orb button */}
        <button
          onClick={canTap ? onPress : undefined}
          disabled={!canTap}
          aria-label={
            isIdle       ? 'Start recording'
            : isRecording  ? 'Stop recording'
            : isProcessing ? 'Processing…'
            : isConfirmed  ? 'Logged successfully'
            : 'Error — try again'
          }
          className={`
            relative z-10 rounded-full flex items-center justify-center
            transition-all duration-300 ease-out
            focus-turmeric
            ${canTap
              ? 'cursor-pointer active:scale-[0.93]'
              : 'cursor-default'}
            ${isIdle ? 'anim-orb-breathe' : ''}
            ${isError ? 'anim-shake' : ''}
          `}
          style={{
            width: size,
            height: size,
            backgroundColor: orbBg,
            boxShadow: orbShadow,
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {isIdle       && <MicIcon       size={Math.round(size * 0.34)} />}
          {isRecording  && <WaveformIcon  height={Math.round(size * 0.38)} />}
          {isProcessing && <SpinnerIcon   size={Math.round(size * 0.34)} />}
          {isConfirmed  && <CheckIcon     size={Math.round(size * 0.34)} />}
          {isError      && <CrossIcon     size={Math.round(size * 0.34)} />}
        </button>
      </div>

      {/* ── State label ── */}
      <div className="text-center" style={{ minHeight: 52 }}>
        {isIdle && (
          <p className="text-muted-500 font-medium text-sm tracking-wide anim-fade-up">
            Tap to speak
          </p>
        )}

        {isRecording && (
          <div className="flex flex-col items-center gap-1 anim-fade-up">
            {timer && (
              <p className="font-mono text-3xl font-bold text-charcoal-800 tabular-nums">
                {timer}
              </p>
            )}
            <p className="text-ink-green-700 font-semibold text-sm">
              Listening…
            </p>
          </div>
        )}

        {isProcessing && (
          <p className="text-ink-green-700 font-medium text-sm anim-fade-up">
            Processing your note…
          </p>
        )}

        {isConfirmed && (
          <p className="text-ink-green-500 font-semibold text-sm anim-fade-up">
            ✓ Logged successfully
          </p>
        )}

        {isError && (
          <p className="text-alert-500 font-medium text-sm anim-fade-up">
            Couldn't process. Try again.
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Icon sub-components ─────────────────────────────────── */

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="white" />
      <path
        d="M5 10a7 7 0 0 0 14 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="12" y1="17" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="9"  y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function WaveformIcon({ height }: { height: number }) {
  const bars: { cls: string; pct: string }[] = [
    { cls: 'anim-wave-1', pct: '40%' },
    { cls: 'anim-wave-2', pct: '80%' },
    { cls: 'anim-wave-3', pct: '100%' },
    { cls: 'anim-wave-4', pct: '80%' },
    { cls: 'anim-wave-5', pct: '40%' },
  ]
  return (
    <div className="flex items-center gap-[5px] origin-center" style={{ height }}>
      {bars.map((b, i) => (
        <div
          key={i}
          className={`rounded-full bg-white origin-center ${b.cls}`}
          style={{ width: 5, height: b.pct }}
        />
      ))}
    </div>
  )
}

function SpinnerIcon({ size }: { size: number }) {
  return (
    <div
      className="rounded-full border-[3px] border-white/25 border-t-white anim-spin-arc"
      style={{ width: size, height: size }}
    />
  )
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12l6 6L20 6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="50"
        style={{
          animation: 'check-draw 0.55s ease-out forwards',
          strokeDashoffset: 50,
        }}
      />
    </svg>
  )
}

function CrossIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

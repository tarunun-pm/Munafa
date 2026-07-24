'use client'

import { useEffect } from 'react'

interface ConfirmationToastProps {
  text: string
  onDismiss: () => void
}

/**
 * ConfirmationToast — slides up from the bottom after a successful voice log.
 * Auto-dismisses after 4s. Tap anywhere on it to dismiss early.
 */
export default function ConfirmationToast({
  text,
  onDismiss,
}: ConfirmationToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className="fixed bottom-28 left-0 right-0 px-4 max-w-[480px] mx-auto anim-slide-up"
      style={{ zIndex: 60 }}
      onClick={onDismiss}
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-2xl px-5 py-4 flex items-start gap-3"
        style={{
          background: '#0F3D2E',
          boxShadow: '0 8px 40px rgba(15,61,46,0.45), 0 2px 12px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        {/* Success tick */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: '#2C7A5E' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7l3 3 6-6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-turmeric-500 mb-0.5 uppercase tracking-wide">
            Noted!
          </p>
          <p className="text-sm leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {text}
          </p>
        </div>
      </div>
    </div>
  )
}

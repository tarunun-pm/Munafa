'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface VendorProfile {
  id: string
  name: string | null
  phone: string
  language?: string
  gender?: string
  dob?: string
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * ProfileModal — User profile, settings, logout, and account deletion.
 * Appears when user taps the top-right settings icon.
 */
export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const router = useRouter()
  const [profile, setProfile]       = useState<VendorProfile | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    setIsLoading(true)
    fetch('/api/vendor')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setProfile(data)
      })
      .catch(err => console.error('[ProfileModal] fetch error:', err))
      .finally(() => setIsLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  async function handleLogout() {
    try {
      await fetch('/api/vendor', { method: 'DELETE' })
      onClose()
      router.push('/onboarding')
    } catch (err) {
      console.error('[ProfileModal] logout error:', err)
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/vendor?action=delete_account', { method: 'DELETE' })
      if (res.ok) {
        onClose()
        router.push('/onboarding')
      } else {
        alert('Failed to delete account. Please try again.')
      }
    } catch (err) {
      console.error('[ProfileModal] delete account error:', err)
      alert('Error connecting to server.')
    } finally {
      setIsDeleting(false)
    }
  }

  const initials = profile?.name
    ? profile.name.slice(0, 2).toUpperCase()
    : 'V'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm anim-fade-up">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
        style={{ borderTop: '3px solid #2C7A5E' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ink-green-700/10 flex items-center justify-center text-ink-green-700 font-bold text-sm">
              ⚙️
            </div>
            <h2 className="text-lg font-bold text-charcoal-800">
              Profile &amp; Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sand-200 flex items-center justify-center text-muted-500 hover:text-charcoal-800 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Profile Card */}
        {isLoading ? (
          <div className="rounded-2xl p-5 shimmer bg-sand-100 h-28" />
        ) : (
          <div className="rounded-2xl p-5 bg-gradient-to-br from-ink-green-700 to-ink-green-800 text-white flex items-center gap-4 shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-turmeric-500 text-ink-green-800 flex items-center justify-center font-extrabold text-xl shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">
                {profile?.name || 'Vendor'}
              </h3>
              <p className="text-xs text-sand-200 font-mono mt-0.5">
                📞 {profile?.phone || 'No phone'}
              </p>
              {profile?.language && (
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 text-sand-100">
                  🌐 {profile.language === 'hi' ? 'Hindi' : 'English'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Account Options */}
        {!showConfirmDelete ? (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-500 px-1">
              Account Actions
            </p>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-between text-charcoal-800 bg-sand-100 hover:bg-sand-200 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🚪</span>
                <span>Log Out</span>
              </div>
              <span className="text-xs text-muted-500">→</span>
            </button>

            {/* Delete Account Trigger */}
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-between text-alert-500 bg-alert-500/10 hover:bg-alert-500/15 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">🗑️</span>
                <span>Delete Account</span>
              </div>
              <span className="text-xs text-alert-500">→</span>
            </button>
          </div>
        ) : (
          /* Confirmation Screen for Delete Account */
          <div className="rounded-2xl p-4 bg-alert-500/10 border border-alert-500/30 flex flex-col gap-3 anim-fade-up">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="font-bold text-sm text-alert-500">
                  Kya aap account delete karna chahte hain?
                </h4>
                <p className="text-xs text-muted-500 mt-1 leading-relaxed">
                  Aapka sabhi transaction history, items, aur daily summaries hamesha ke liye delete ho jayenge. Yeh action undo nahi kiya ja sakta.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-white border border-sand-300 text-charcoal-800 hover:bg-sand-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-alert-500 text-white hover:bg-alert-600 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
              >
                {isDeleting ? (
                  <span>Deleting…</span>
                ) : (
                  <span>Haan, Delete Karein</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

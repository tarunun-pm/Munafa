'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

type Step = 1 | 2 | 3
type Gender = 'male' | 'female' | 'other'
type Language = 'en' | 'hi'

interface Profile {
  name: string
  gender: Gender | null
  dob: string
}

/* ── Helpers ─────────────────────────────────────────── */
function inputStyle(active: boolean) {
  return {
    background: 'rgba(255,255,255,0.08)',
    border: `1.5px solid ${active ? 'rgba(242,169,59,0.7)' : 'rgba(255,255,255,0.14)'}`,
    color: 'white',
    transition: 'border-color 0.2s ease',
  }
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const router = useRouter()

  /* Step state */
  const [step, setStep] = useState<Step>(1)

  /* Step 1 — Phone + OTP */
  const [phone, setPhone]         = useState('')
  const [otpSent, setOtpSent]     = useState(false)
  const [otp, setOtp]             = useState(Array(6).fill(''))
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [authErr, setAuthErr]     = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  /* Step 2 — Profile */
  const [profile, setProfile] = useState<Profile>({
    name: '', gender: null, dob: '',
  })

  /* Step 3 — Language */
  const [lang, setLang]         = useState<Language>('en')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErr, setSubmitErr]       = useState('')

  /* ── Send OTP ── */
  async function handleSendOtp() {
    if (phone.length < 10) return
    setIsSending(true)
    setAuthErr('')
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
        options: { channel: 'sms' },
      })
      if (error) {
        setAuthErr(error.message)
      } else {
        setOtpSent(true)
        setTimeout(() => otpRefs.current[0]?.focus(), 80)
      }
    } catch {
      setAuthErr('Could not send OTP. Try again.')
    } finally {
      setIsSending(false)
    }
  }

  /* ── OTP input ── */
  function handleOtpChange(idx: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus()
    if (val && idx === 5 && next.every(d => d)) verifyOtp(next.join(''))
  }

  function handleOtpKey(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0)
      otpRefs.current[idx - 1]?.focus()
  }

  /* ── Verify OTP ── */
  async function verifyOtp(code: string) {
    setIsVerifying(true)
    setAuthErr('')
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: code,
        type: 'sms',
      })
      if (error) {
        setAuthErr(error.message)
      } else {
        goToStep(2)
      }
    } catch {
      setAuthErr('Verification failed. Try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  /* ── Demo bypass ── */
  function handleDemoSkip() { goToStep(2) }

  function goToStep(s: Step) {
    setStep(s)
    setAuthErr('')
    setSubmitErr('')
  }

  /* ── Final submit ── */
  async function handleFinish() {
    setIsSubmitting(true)
    setSubmitErr('')
    try {
      const res = await fetch('/api/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone ? `+91${phone}` : '+910000000000',  // demo fallback
          name: profile.name.trim() || 'Vendor',
          gender: profile.gender,
          dob: profile.dob || null,
          language: lang,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Setup failed')
      }
      router.push('/dashboard')
    } catch (err: unknown) {
      setSubmitErr(err instanceof Error ? err.message : 'Something went wrong')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ backgroundColor: '#0F3D2E' }}
    >
      {/* Mandi dawn glow */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none mandi-dawn-glow"
        style={{ height: '55vh' }}
      />

      {/* Glass card */}
      <div
        className="relative w-full max-w-[400px] rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.065)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.115)',
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-7 pt-8 pb-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-7">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
              style={{
                background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)',
                color: '#0F3D2E',
                fontSize: 18,
              }}
            >
              ₹
            </div>
            <span
              className="text-white font-bold text-xl tracking-tight"
              style={{ fontFamily: 'var(--font-baloo)' }}
            >
              Munafa
            </span>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-2 mb-6">
            {([1, 2, 3] as Step[]).map(s => (
              <div
                key={s}
                className="rounded-full transition-all duration-500 ease-out"
                style={{
                  height: 6,
                  width: s === step ? 28 : s < step ? 14 : 8,
                  background:
                    s < step
                      ? 'rgba(242,169,59,0.55)'
                      : s === step
                      ? '#F2A93B'
                      : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>

          {/* Step content with enter animation */}
          <div key={step} className="anim-step-in">
            {step === 1 && (
              <StepPhone
                phone={phone} setPhone={setPhone}
                otp={otp} otpRefs={otpRefs}
                otpSent={otpSent}
                onSend={handleSendOtp}
                onOtpChange={handleOtpChange}
                onOtpKey={handleOtpKey}
                onVerify={() => verifyOtp(otp.join(''))}
                isSending={isSending}
                isVerifying={isVerifying}
                error={authErr}
                onSkip={handleDemoSkip}
              />
            )}
            {step === 2 && (
              <StepProfile
                profile={profile}
                onChange={setProfile}
                onNext={() => goToStep(3)}
                canProceed={profile.name.trim().length >= 2 && profile.gender !== null}
              />
            )}
            {step === 3 && (
              <StepLanguage
                lang={lang}
                setLang={setLang}
                onFinish={handleFinish}
                isSubmitting={isSubmitting}
                error={submitErr}
              />
            )}
          </div>
        </div>
      </div>

      <p
        className="mt-6 text-center text-xs"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        Your data stays private. Always.
      </p>
    </div>
  )
}

/* ── Step 1: Phone + OTP ──────────────────────────────── */
function StepPhone({
  phone, setPhone, otp, otpRefs, otpSent,
  onSend, onOtpChange, onOtpKey, onVerify,
  isSending, isVerifying, error, onSkip,
}: {
  phone: string
  setPhone: (v: string) => void
  otp: string[]
  otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  otpSent: boolean
  onSend: () => void
  onOtpChange: (i: number, v: string) => void
  onOtpKey: (i: number, e: React.KeyboardEvent) => void
  onVerify: () => void
  isSending: boolean
  isVerifying: boolean
  error: string
  onSkip: () => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-[26px] font-bold text-white leading-tight"
          style={{ fontFamily: 'var(--font-baloo)' }}
        >
          {otpSent ? 'Verify your number' : 'Welcome to Munafa'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.48)' }}>
          {otpSent
            ? `Enter the OTP sent to +91 ${phone}`
            : 'Track your daily profit in under 30 seconds.'}
        </p>
      </div>

      {!otpSent ? (
        /* ── Phone input ── */
        <div className="space-y-3">
          <div>
            <label
              className="block text-xs font-semibold mb-2 uppercase tracking-wide"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Mobile Number
            </label>
            <div
              className="flex rounded-xl overflow-hidden"
              style={inputStyle(phone.length > 0)}
            >
              <div
                className="flex items-center gap-1.5 px-3.5 py-3.5 flex-shrink-0 border-r"
                style={{ borderColor: 'rgba(255,255,255,0.14)' }}
              >
                <span className="text-base">🇮🇳</span>
                <span className="font-semibold text-sm text-white/70">+91</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                className="flex-1 bg-transparent px-3.5 py-3.5 text-white placeholder-white/25 text-base font-medium focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="text-xs text-alert-500">{error}</p>}
          <button
            onClick={onSend}
            disabled={phone.length < 10 || isSending}
            className="w-full py-3.5 rounded-xl font-bold text-ink-green-900 text-[15px] transition-all duration-200 disabled:opacity-40 active:scale-[0.98]"
            style={{
              background:
                phone.length === 10
                  ? 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)'
                  : 'rgba(242,169,59,0.35)',
            }}
          >
            {isSending ? 'Sending OTP…' : 'Get Started →'}
          </button>
          <button
            onClick={onSkip}
            className="w-full text-center text-xs underline"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Continue without OTP (demo mode)
          </button>
        </div>
      ) : (
        /* ── OTP boxes ── */
        <div className="space-y-3">
          <div className="flex gap-2">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => onOtpChange(i, e.target.value)}
                onKeyDown={e => onOtpKey(i, e)}
                className="flex-1 text-center text-2xl font-bold rounded-xl py-3.5 focus:outline-none transition-all"
                style={{
                  background: digit ? 'rgba(242,169,59,0.18)' : 'rgba(255,255,255,0.07)',
                  border: digit ? '1.5px solid #F2A93B' : '1.5px solid rgba(255,255,255,0.14)',
                  color: 'white',
                  minWidth: 0,
                }}
              />
            ))}
          </div>
          {error && <p className="text-xs text-alert-500">{error}</p>}
          <button
            onClick={onVerify}
            disabled={otp.some(d => !d) || isVerifying}
            className="w-full py-3.5 rounded-xl font-bold text-ink-green-900 text-[15px] transition-all disabled:opacity-40 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)' }}
          >
            {isVerifying ? 'Verifying…' : 'Verify OTP'}
          </button>
          <button
            onClick={onSkip}
            className="w-full text-center text-xs underline"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Skip for demo
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Step 2: Name / Gender / DOB ──────────────────────── */
function StepProfile({
  profile, onChange, onNext, canProceed,
}: {
  profile: Profile
  onChange: (p: Profile) => void
  onNext: () => void
  canProceed: boolean
}) {
  const genders: { value: Gender; label: string; emoji: string }[] = [
    { value: 'male',   label: 'Male',   emoji: '👨' },
    { value: 'female', label: 'Female', emoji: '👩' },
    { value: 'other',  label: 'Other',  emoji: '🧑' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-[26px] font-bold text-white leading-tight"
          style={{ fontFamily: 'var(--font-baloo)' }}
        >
          Tell us about yourself
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.48)' }}>
          Personalise your Munafa experience.
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label
          className="block text-xs font-semibold mb-2 uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Full Name <span style={{ color: '#F2A93B' }}>*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Ramesh Yadav"
          value={profile.name}
          onChange={e => onChange({ ...profile, name: e.target.value })}
          className="w-full rounded-xl px-4 py-3.5 text-base font-medium placeholder-white/25 focus:outline-none transition-all"
          style={inputStyle(profile.name.length >= 2)}
        />
      </div>

      {/* Gender */}
      <div>
        <label
          className="block text-xs font-semibold mb-2 uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Gender <span style={{ color: '#F2A93B' }}>*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {genders.map(g => (
            <button
              key={g.value}
              onClick={() => onChange({ ...profile, gender: g.value })}
              className="flex flex-col items-center gap-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{
                background:
                  profile.gender === g.value
                    ? 'rgba(242,169,59,0.2)'
                    : 'rgba(255,255,255,0.07)',
                border:
                  profile.gender === g.value
                    ? '1.5px solid #F2A93B'
                    : '1.5px solid rgba(255,255,255,0.12)',
                color:
                  profile.gender === g.value
                    ? '#F2A93B'
                    : 'rgba(255,255,255,0.6)',
              }}
            >
              <span className="text-xl">{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label
          className="block text-xs font-semibold mb-2 uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Date of Birth{' '}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none' }}>
            (optional)
          </span>
        </label>
        <input
          type="date"
          value={profile.dob}
          max={new Date().toISOString().split('T')[0]}
          min="1940-01-01"
          onChange={e => onChange({ ...profile, dob: e.target.value })}
          className="w-full rounded-xl px-4 py-3.5 text-base font-medium focus:outline-none transition-all"
          style={{
            ...inputStyle(!!profile.dob),
            colorScheme: 'dark',
            color: profile.dob ? 'white' : 'rgba(255,255,255,0.3)',
          }}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-3.5 rounded-xl font-bold text-ink-green-900 text-[15px] transition-all disabled:opacity-40 active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)' }}
      >
        Continue →
      </button>
    </div>
  )
}

/* ── Step 3: Language ─────────────────────────────────── */
function StepLanguage({
  lang, setLang, onFinish, isSubmitting, error,
}: {
  lang: Language
  setLang: (l: Language) => void
  onFinish: () => void
  isSubmitting: boolean
  error: string
}) {
  const options: {
    value: Language
    native: string
    flag: string
    desc: string
  }[] = [
    { value: 'en', native: 'English', flag: '🇬🇧', desc: 'App in English' },
    { value: 'hi', native: 'हिंदी',   flag: '🇮🇳', desc: 'ऐप हिंदी में' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1
          className="text-[26px] font-bold text-white leading-tight"
          style={{ fontFamily: 'var(--font-baloo)' }}
        >
          Choose your language
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.48)' }}>
          You can change this anytime in settings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setLang(opt.value)}
            className="flex flex-col items-center gap-2.5 py-6 rounded-2xl transition-all duration-200 active:scale-95"
            style={{
              background:
                lang === opt.value
                  ? 'rgba(242,169,59,0.16)'
                  : 'rgba(255,255,255,0.06)',
              border:
                lang === opt.value
                  ? '2px solid #F2A93B'
                  : '2px solid rgba(255,255,255,0.1)',
            }}
          >
            <span className="text-[36px]">{opt.flag}</span>
            <div className="text-center">
              <p className="font-bold text-white text-sm">{opt.native}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
                {opt.desc}
              </p>
            </div>
            {lang === opt.value && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#F2A93B' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="#0F3D2E"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-alert-500">{error}</p>}

      <button
        onClick={onFinish}
        disabled={isSubmitting}
        className="w-full py-3.5 rounded-xl font-bold text-ink-green-900 text-[15px] transition-all disabled:opacity-60 active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #F2A93B 0%, #DB8F1F 100%)' }}
      >
        {isSubmitting ? 'Setting up your account…' : "Let's Begin 🚀"}
      </button>
    </div>
  )
}

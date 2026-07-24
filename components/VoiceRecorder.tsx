'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import MicOrb from './MicOrb'
import type { VoiceRecorderState, LogVoiceResponse } from '@/types'

/* ── Web Speech API inline types (not in TS lib by default) ── */
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}
interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart:  ((this: SpeechRecognition, ev: Event) => void) | null
  onend:    ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror:  ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop():  void
  abort(): void
}
declare const SpeechRecognition: {
  new(): SpeechRecognition
  prototype: SpeechRecognition
}
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface VoiceRecorderProps {
  onStateChange?: (state: VoiceRecorderState) => void
  onComplete?: (result: LogVoiceResponse) => void
}

/**
 * VoiceRecorder — uses the browser Web Speech API for transcription.
 * Falls back to a manual text input if speech recognition is unavailable.
 */
export default function VoiceRecorder({
  onStateChange,
  onComplete,
}: VoiceRecorderProps) {
  const [state, setState]   = useState<VoiceRecorderState>('idle')
  const [timer, setTimer]   = useState('0:00')
  const [supported, setSupported] = useState(true)
  const [debugText, setDebugText] = useState('')

  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef    = useRef<number>(0)
  const transcriptRef   = useRef<string>('')
  const hasErroredRef   = useRef(false)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  function updateState(next: VoiceRecorderState) {
    setState(next)
    onStateChange?.(next)
  }

  function startTimer() {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      setTimer(`${m}:${s.toString().padStart(2, '0')}`)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimer('0:00')
  }

  /** Sends the transcript text to /api/log-voice */
  async function processTranscript(text: string) {
    // Prevent double-processing
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
      console.log('[VoiceRecorder] Sending transcript:', text)
      setDebugText(text)

      const formData = new FormData()
      formData.append('transcript', text)

      const res = await fetch('/api/log-voice', { method: 'POST', body: formData })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errorMsg = res.status === 401
          ? 'Session expired. Please re-login.'
          : (errJson.error || `Server error (${res.status}). Try again.`)
        console.error('[VoiceRecorder] API error:', res.status, errorMsg)
        updateState('error')
        onComplete?.({ success: false, entries: [], confirmation_text: errorMsg })
        setTimeout(() => updateState('idle'), 3000)
        return
      }

      const data: LogVoiceResponse = await res.json()
      console.log('[VoiceRecorder] API response:', data)

      if (data.success) {
        updateState('confirmed')
        onComplete?.(data)
        setTimeout(() => updateState('idle'), 3000)
      } else {
        updateState('error')
        onComplete?.(data)
        setTimeout(() => updateState('idle'), 3000)
      }
    } catch (err) {
      console.error('[VoiceRecorder] pipeline error:', err)
      updateState('error')
      onComplete?.({ success: false, entries: [], confirmation_text: 'Connection failed. Try again.' })
      setTimeout(() => updateState('idle'), 3000)
    } finally {
      isProcessingRef.current = false
    }
  }

  /** Starts Web Speech API recognition */
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      updateState('error')
      setTimeout(() => updateState('idle'), 3000)
      return
    }

    const recognition = new SR()
    recognition.lang            = 'hi-IN'
    recognition.continuous      = false  // Single utterance mode — more reliable
    recognition.interimResults  = false  // Only fire when result is final
    recognition.maxAlternatives = 1

    transcriptRef.current = ''
    hasErroredRef.current = false
    isProcessingRef.current = false

    recognition.onstart = () => {
      console.log('[VoiceRecorder] Speech recognition started')
      updateState('recording')
      startTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + ' '
      }
      transcriptRef.current = text.trim()
      console.log('[VoiceRecorder] Got result:', transcriptRef.current)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' happens on manual stop — not an error
      if (event.error === 'aborted') return

      console.error('[VoiceRecorder] speech error:', event.error)
      hasErroredRef.current = true
      stopTimer()

      const messages: Record<string, string> = {
        'no-speech': 'Kuch sunai nahi diya. Dobara boliye.',
        'not-allowed': 'Microphone permission denied. Please allow mic access.',
        'audio-capture': 'No microphone found. Check your device.',
        'network': 'Network error. Check your connection.',
      }

      const msg = messages[event.error] || `Speech error: ${event.error}`
      updateState('error')
      onComplete?.({ success: false, entries: [], confirmation_text: msg })
      setTimeout(() => updateState('idle'), 3000)
    }

    recognition.onend = () => {
      console.log('[VoiceRecorder] Speech recognition ended. Transcript:', transcriptRef.current)
      stopTimer()

      // Don't process if we already handled an error
      if (hasErroredRef.current) return

      const text = transcriptRef.current.trim()
      if (text) {
        updateState('processing')
        processTranscript(text)
      } else {
        updateState('error')
        onComplete?.({
          success: false,
          entries: [],
          confirmation_text: 'Kuch sunai nahi diya. Dobara boliye.',
        })
        setTimeout(() => updateState('idle'), 3000)
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start recognition:', err)
      updateState('error')
      onComplete?.({
        success: false, entries: [],
        confirmation_text: 'Could not start microphone. Try again.',
      })
      setTimeout(() => updateState('idle'), 3000)
    }
  }, [])

  function stopRecording() {
    if (recognitionRef.current && state === 'recording') {
      console.log('[VoiceRecorder] Stopping recognition...')
      recognitionRef.current.stop()
    }
  }

  function handleOrbPress() {
    if (state === 'idle')           startRecording()
    else if (state === 'recording') stopRecording()
  }

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: '#FCE8C4' }}>🎙️</div>
        <p className="text-sm font-semibold text-charcoal-800">Voice not supported</p>
        <p className="text-xs text-muted-500">
          Please use Chrome or Safari to use voice logging.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <MicOrb
        state={state}
        onPress={handleOrbPress}
        timer={state === 'recording' ? timer : undefined}
        size={160}
      />
      {/* Debug: show captured transcript */}
      {debugText && state === 'processing' && (
        <p className="text-[10px] text-muted-500 mt-2 text-center px-8 max-w-xs truncate">
          &ldquo;{debugText}&rdquo;
        </p>
      )}
    </div>
  )
}

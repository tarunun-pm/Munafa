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
  /** Called every time the recorder state changes. */
  onStateChange?: (state: VoiceRecorderState) => void
  /** Called after a successful or failed voice log with the server response. */
  onComplete?: (result: LogVoiceResponse) => void
}

/**
 * VoiceRecorder — uses the browser Web Speech API for transcription (free, no OpenAI needed).
 * Sends the transcript text directly to /api/log-voice, which passes it to Claude.
 * Handles all 5 states: idle → recording → processing → confirmed/error → idle.
 */
export default function VoiceRecorder({
  onStateChange,
  onComplete,
}: VoiceRecorderProps) {
  const [state, setState]   = useState<VoiceRecorderState>('idle')
  const [timer, setTimer]   = useState('0:00')
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef   = useRef<number>(0)
  const transcriptRef  = useRef<string>('')

  /** Check browser support on mount */
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  /** Updates state locally and notifies parent. */
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

  /** Sends the transcript text to /api/log-voice and handles response. */
  async function processTranscript(text: string) {
    try {
      const formData = new FormData()
      formData.append('transcript', text)

      const res  = await fetch('/api/log-voice', { method: 'POST', body: formData })
      const data: LogVoiceResponse = await res.json()

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
      setTimeout(() => updateState('idle'), 3000)
    }
  }

  /** Starts Web Speech API recognition. */
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      updateState('error')
      setTimeout(() => updateState('idle'), 3000)
      return
    }

    const recognition = new SR()
    recognition.lang             = 'hi-IN'   // Hindi — also picks up Hinglish well
    recognition.continuous       = true       // keep listening until user stops
    recognition.interimResults   = false      // only final results
    recognition.maxAlternatives  = 1

    transcriptRef.current = ''

    recognition.onstart = () => {
      updateState('recording')
      startTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Accumulate all final results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript + ' '
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[VoiceRecorder] speech error:', event.error)
      stopTimer()
      // 'no-speech' is not a fatal error — just means silence
      if (event.error === 'no-speech') {
        updateState('error')
        onComplete?.({
          success: false,
          entries: [],
          confirmation_text: 'Kuch sunai nahi diya. Dobara boliye.',
        })
      } else {
        updateState('error')
      }
      setTimeout(() => updateState('idle'), 3000)
    }

    recognition.onend = () => {
      stopTimer()
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
    recognition.start()
  }, [])

  /** Stops recognition — triggers onend which sends transcript. */
  function stopRecording() {
    if (recognitionRef.current && state === 'recording') {
      recognitionRef.current.stop()
      // timer + state update handled in onend
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
    <MicOrb
      state={state}
      onPress={handleOrbPress}
      timer={state === 'recording' ? timer : undefined}
      size={160}
    />
  )
}

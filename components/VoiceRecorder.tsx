'use client'

import { useState, useRef, useCallback } from 'react'
import MicOrb from './MicOrb'
import type { VoiceRecorderState, LogVoiceResponse } from '@/types'

interface VoiceRecorderProps {
  /** Called every time the recorder state changes. */
  onStateChange?: (state: VoiceRecorderState) => void
  /** Called after a successful or failed voice log with the server response. */
  onComplete?: (result: LogVoiceResponse) => void
}

/**
 * VoiceRecorder — wraps MicOrb with MediaRecorder API and /api/log-voice pipeline.
 * Handles all 5 states: idle → recording → processing → confirmed/error → idle.
 */
export default function VoiceRecorder({
  onStateChange,
  onComplete,
}: VoiceRecorderProps) {
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [timer, setTimer] = useState('0:00')

  const recorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

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

  /** Starts microphone recording. */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Prefer webm/opus; fall back to browser default
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(blob)
      }

      recorderRef.current = recorder
      recorder.start(100) // collect every 100ms

      updateState('recording')
      startTimer()
    } catch (err) {
      console.error('[VoiceRecorder] getUserMedia failed:', err)
      updateState('error')
      setTimeout(() => updateState('idle'), 3000)
    }
  }, [])

  /** Stops recording and triggers pipeline. */
  function stopRecording() {
    if (recorderRef.current && state === 'recording') {
      recorderRef.current.stop()
      stopTimer()
      updateState('processing')
    }
  }

  /** Sends audio to /api/log-voice and handles response. */
  async function processAudio(blob: Blob) {
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const res = await fetch('/api/log-voice', {
        method: 'POST',
        body: formData,
      })

      const data: LogVoiceResponse = await res.json()

      if (data.success) {
        updateState('confirmed')
        onComplete?.(data)
        setTimeout(() => updateState('idle'), 3000)
      } else {
        updateState('error')
        onComplete?.(data)  // pass error text through for toast
        setTimeout(() => updateState('idle'), 3000)
      }
    } catch (err) {
      console.error('[VoiceRecorder] pipeline error:', err)
      updateState('error')
      setTimeout(() => updateState('idle'), 3000)
    }
  }

  function handleOrbPress() {
    if (state === 'idle')           startRecording()
    else if (state === 'recording') stopRecording()
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

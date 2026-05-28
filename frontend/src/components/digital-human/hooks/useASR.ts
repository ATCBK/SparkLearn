'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseASROptions {
  lang?: string
  onResult?: (text: string) => void
  onError?: (error: string) => void
}

export function useASR(options: UseASROptions = {}) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const errorCountRef = useRef(0)
  const optsRef = useRef(options)
  optsRef.current = options

  const getRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === 'undefined') return null
    const SpeechRecognitionAPI = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return null
    return new SpeechRecognitionAPI()
  }, [])

  useEffect(() => {
    if (!getRecognition()) {
      setIsSupported(false)
    }
  }, [getRecognition])

  const startListening = useCallback(() => {
    const recognition = getRecognition()
    if (!recognition) {
      setIsSupported(false)
      setError('SpeechRecognition 不可用')
      return
    }

    recognition.lang = optsRef.current.lang || 'zh-CN'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript || ''
      const confidence = event.results[0]?.[0]?.confidence || 0

      if (confidence < 0.5) {
        setError('未听清，请重试')
        errorCountRef.current++
        if (errorCountRef.current >= 3) {
          setIsSupported(false)
          optsRef.current.onError?.('连续识别失败，已切换到文字输入模式')
        }
        return
      }

      errorCountRef.current = 0
      setError(null)
      setIsListening(false)
      optsRef.current.onResult?.(transcript.trim())
    }

    recognition.onerror = (event: Event) => {
      const e = event as SpeechRecognitionErrorEvent
      setIsListening(false)
      if (e.error !== 'aborted') {
        setError(`语音识别错误: ${e.error}`)
        errorCountRef.current++
        if (errorCountRef.current >= 3) {
          setIsSupported(false)
        }
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
      setIsListening(true)
      recognitionRef.current = recognition
    } catch {
      setIsListening(false)
      setError('无法启动语音识别')
    }
  }, [getRecognition])

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
  }
}

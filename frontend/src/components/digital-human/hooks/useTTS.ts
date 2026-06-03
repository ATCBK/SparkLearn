'use client'

import { useRef, useState, useCallback } from 'react'

export interface TTSOptions {
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
  lang?: string
}

export interface TTSEvents {
  onStart?: () => void
  onEnd?: () => void
  onBoundary?: (charIndex: number) => void
  onError?: (error: string) => void
}

interface AudioAnalyser {
  audioContext: AudioContext
  sourceNode: AudioBufferSourceNode
  analyserNode: AnalyserNode
  audioData: Float32Array
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const analyserRef = useRef<AudioAnalyser | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    // Stop browser TTS
    if (utteranceRef.current && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    // Stop Xunfei audio
    if (analyserRef.current) {
      try {
        analyserRef.current.sourceNode.stop()
      } catch { /* already stopped */ }
      analyserRef.current.audioContext.close().catch(() => {})
      analyserRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  const createAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  const speakWithBrowser = useCallback((text: string, options: TTSOptions, events?: TTSEvents): (() => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsSupported(false)
      events?.onError?.('SpeechSynthesis 不可用')
      return stop
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options.lang || 'zh-CN'
    utterance.rate = options.rate ?? 1.0
    utterance.pitch = options.pitch ?? 1.0
    utterance.volume = options.volume ?? 1.0

    utterance.onstart = () => {
      setIsSpeaking(true)
      events?.onStart?.()
    }

    utterance.onend = () => {
      setIsSpeaking(false)
      utteranceRef.current = null
      events?.onEnd?.()
    }

    utterance.onboundary = (e) => {
      if (e.charIndex !== undefined) {
        events?.onBoundary?.(e.charIndex)
      }
    }

    utterance.onerror = (e) => {
      setIsSpeaking(false)
      utteranceRef.current = null
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        events?.onError?.(`TTS 播放错误: ${e.error}`)
      }
    }

    utteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)

    return stop
  }, [stop])

  const speakWithXunfei = useCallback(async (text: string, options: TTSOptions, events?: TTSEvents): Promise<(() => void)> => {
    try {
      console.log('[TTS] 开始合成语音, text长度:', text.length)
      const { api } = await import('@/lib/api')
      const audioBlob = await api.synthesizeSpeech(text, {
        voice: options.voice,
        speed: Math.round((options.rate ?? 1.0) * 50),
        volume: Math.round((options.volume ?? 1.0) * 100),
        pitch: Math.round((options.pitch ?? 1.0) * 50),
      })
      console.log('[TTS] 语音合成成功, blob大小:', audioBlob.size, 'type:', audioBlob.type)

      const ctx = createAudioContext()
      console.log('[TTS] AudioContext state:', ctx.state)

      // 关键修复：确保 AudioContext 处于运行状态
      // 由于 createAudioContext 在 await 之后调用，已脱离用户手势范围，
      // Chrome 等浏览器会将 AudioContext 置于 suspended 状态
      if (ctx.state === 'suspended') {
        console.log('[TTS] AudioContext 被挂起，尝试恢复...')
        await ctx.resume()
        console.log('[TTS] AudioContext 恢复后 state:', ctx.state)
      }

      const arrayBuffer = await audioBlob.arrayBuffer()
      console.log('[TTS] arrayBuffer 大小:', arrayBuffer.byteLength)
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      console.log('[TTS] 音频解码成功, duration:', audioBuffer.duration.toFixed(2), 's, sampleRate:', audioBuffer.sampleRate)

      const sourceNode = ctx.createBufferSource()
      sourceNode.buffer = audioBuffer

      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.3

      sourceNode.connect(analyserNode)
      analyserNode.connect(ctx.destination)

      const audioData = new Float32Array(analyserNode.frequencyBinCount)
      analyserRef.current = { audioContext: ctx, sourceNode, analyserNode, audioData }

      sourceNode.onended = () => {
        console.log('[TTS] 音频播放结束')
        setIsSpeaking(false)
        analyserRef.current = null
        events?.onEnd?.()
      }

      sourceNode.start(0)
      setIsSpeaking(true)
      console.log('[TTS] 音频开始播放, analyserRef 已设置')
      events?.onStart?.()

      return stop
    } catch (e) {
      console.error('[TTS] 合成/播放失败:', e)
      // Fallback to browser TTS
      events?.onError?.(`讯飞 TTS 失败，降级到浏览器语音: ${e instanceof Error ? e.message : 'unknown'}`)
      return speakWithBrowser(text, options, events)
    }
  }, [stop, speakWithBrowser, createAudioContext])

  const speak = useCallback(async (text: string, options: TTSOptions = {}, events?: TTSEvents) => {
    return speakWithXunfei(text, options, events)
  }, [speakWithXunfei])

  const getAnalyser = useCallback((): AudioAnalyser | null => {
    return analyserRef.current
  }, [])

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    getAnalyser,
  }
}

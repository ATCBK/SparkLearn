'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface DigitalHumanLiveProps {
  className?: string
  /** 来自 TTS 的音频分析器，用于驱动口型同步 */
  audioAnalyser?: AnalyserNode | null
  /** 是否正在说话（用于浏览器 TTS 无 AnalyserNode 时的模拟口型） */
  isSpeaking?: boolean
}

export default function DigitalHumanLive({ className = '', audioAnalyser, isSpeaking }: DigitalHumanLiveProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const animIdRef = useRef<number>(0)
  // 缓存清除：每次组件挂载时生成唯一版本号
  const iframeVersion = useRef<string>(Date.now().toString(36)).current

  useEffect(() => {
    // Listen for messages from iframe
    const handler = (e: MessageEvent) => {
      if (e.data === 'dh-live-ready') setLoaded(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // 发送音频振幅到 iframe 驱动口型
  const sendAmplitude = useCallback((amplitude: number, speaking: boolean) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) {
      if (speaking) console.warn('[DigitalHumanLive] iframe.contentWindow 不可用，无法发送口型数据')
      return
    }
    iframe.contentWindow.postMessage({
      type: 'dh-audio-amplitude',
      amplitude,
      speaking,
    }, '*')
    // 调试日志（仅在有明显振幅时打印，避免刷屏）
    if (speaking && amplitude > 0.05) {
      console.log('[Parent] 发送口型振幅:', amplitude.toFixed(3))
    }
  }, [])

  // 从 AnalyserNode 读取振幅并发送
  // 即使 loaded 为 false 也启动振幅读取，因为 iframe 可能在 TTS 播放期间就绪
  useEffect(() => {
    if (audioAnalyser) {
      console.log('[DigitalHumanLive] AnalyserNode 已就绪，开始口型同步')
      // 有 AnalyserNode：读取实时音频振幅
      const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount)

      function tick() {
        if (!audioAnalyser) return

        audioAnalyser.getByteTimeDomainData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128
          sum += value * value
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const amplitude = Math.min(1, rms * 8)

        sendAmplitude(amplitude, true)
        animIdRef.current = requestAnimationFrame(tick)
      }

      animIdRef.current = requestAnimationFrame(tick)

      return () => {
        if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
        sendAmplitude(0, false)
      }
    } else if (isSpeaking) {
      // 无 AnalyserNode 但正在说话（浏览器 TTS）：模拟口型
      let phase = 0
      function tick() {
        phase += 0.15
        // 模拟自然说话的口型变化
        const amplitude = 0.3 + Math.sin(phase) * 0.2 + Math.sin(phase * 2.7) * 0.15 + Math.random() * 0.1
        sendAmplitude(amplitude, true)
        animIdRef.current = requestAnimationFrame(tick)
      }
      animIdRef.current = requestAnimationFrame(tick)

      return () => {
        if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
        sendAmplitude(0, false)
      }
    } else {
      // 不在说话：停止口型
      sendAmplitude(0, false)
    }
  }, [audioAnalyser, isSpeaking, sendAmplitude])

  // 组件卸载时停止口型
  useEffect(() => {
    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
    }
  }, [])

  return (
    <div className={`relative w-full h-full ${className}`} style={{ background: 'transparent' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#2563eb] border-t-transparent animate-spin" />
            <span className="text-xs text-[#9ca3af]">数字人加载中...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`/dh-live/index.html?v=${iframeVersion}`}
        onLoad={() => {
          // Fallback: mark as loaded after 3s even if no message received
          setTimeout(() => setLoaded(true), 3000)
        }}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.5s',
        }}
        allow="autoplay"
        title="数字人"
      />
    </div>
  )
}

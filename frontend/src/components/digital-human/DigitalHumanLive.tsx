'use client'

import { useRef, useState, useEffect } from 'react'

interface DigitalHumanLiveProps {
  className?: string
}

export default function DigitalHumanLive({ className = '' }: DigitalHumanLiveProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Listen for messages from iframe
    const handler = (e: MessageEvent) => {
      if (e.data === 'dh-live-ready') setLoaded(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className={`relative w-full h-full ${className}`} style={{ background: 'transparent' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#7c4dff] border-t-transparent animate-spin" />
            <span className="text-xs text-white/50">数字人加载中...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/dh-live/index.html"
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

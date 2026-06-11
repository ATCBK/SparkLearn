'use client'

import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import DigitalHumanStage from './DigitalHumanStage'
import { DEFAULT_AVATAR } from './avatar-presets'

interface DigitalHumanSceneProps {
  avatarId?: string
  visemeWeights?: Float32Array | null
  state?: 'idle' | 'loading_memory' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'
  className?: string
  onFpsWarning?: (lowFps: boolean) => void
}

function LoadingFallback() {
  return (
    <mesh>
      <torusGeometry args={[0.3, 0.12, 16, 32]} />
      <meshStandardMaterial color="#7c4dff" wireframe />
    </mesh>
  )
}

const stateLabels: Record<string, string> = {
  idle: '在线',
  loading_memory: '学习中...',
  ready: '就绪',
  listening: '聆听中...',
  thinking: '思考中...',
  speaking: '播报中...',
  error: '出错了',
}

function StaticAvatarFallback({ state }: { state: string }) {
  const label = stateLabels[state] || '在线'
  const pulse = state === 'speaking' || state === 'listening'

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,77,255,0.15) 0%, transparent 70%)' }}>
      <div className="relative">
        <svg width="120" height="160" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg"
          className={pulse ? 'animate-pulse' : ''}
          style={state === 'speaking' ? { animation: 'breathe 2s ease-in-out infinite' } : undefined}>
          {/* Head */}
          <ellipse cx="60" cy="48" rx="32" ry="38" fill="url(#avatarGrad)" />
          {/* Eyes */}
          <ellipse cx="46" cy="42" rx="5" ry="6" fill="#1a1a2e" />
          <ellipse cx="74" cy="42" rx="5" ry="6" fill="#1a1a2e" />
          <circle cx="47" cy="40" r="2" fill="white" />
          <circle cx="75" cy="40" r="2" fill="white" />
          {/* Mouth */}
          {state === 'speaking' ? (
            <ellipse cx="60" cy="60" rx="6" ry="8" fill="#1a1a2e" />
          ) : (
            <path d="M50 58 Q60 66 70 58" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
          {/* Body */}
          <path d="M36 86 L36 130 Q36 148 60 148 Q84 148 84 130 L84 86" fill="url(#bodyGrad)" />
          {/* Shoulders */}
          <ellipse cx="30" cy="90" rx="14" ry="8" fill="url(#bodyGrad)" />
          <ellipse cx="90" cy="90" rx="14" ry="8" fill="url(#bodyGrad)" />
          <defs>
            <linearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#4fc3f7" />
              <stop offset="1" stopColor="#7c4dff" />
            </linearGradient>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#4fc3f7" />
              <stop offset="1" stopColor="#7c4dff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${state === 'error' ? 'bg-red-400' : 'bg-green-400'} ${pulse ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>
    </div>
  )
}

function ErrorFallback({ message }: { message: string }) {
  return <StaticAvatarFallback state="error" />
}

export default function DigitalHumanScene({
  avatarId = DEFAULT_AVATAR.id,
  visemeWeights,
  state = 'idle',
  className = '',
  onFpsWarning,
}: DigitalHumanSceneProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [lowFps, setLowFps] = useState(false)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadTimerRef.current = setTimeout(() => {
      if (loading) {
        setError('模型加载超时，请检查网络连接')
        setLoading(false)
      }
    }, 10000)

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    }
  }, [loading, avatarId])

  // WebGL context loss handling
  useEffect(() => {
    if (isMobile) return
    let cleanup: (() => void) | null = null

    const id = setTimeout(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return
      canvasRef.current = canvas

      const onContextLost = (e: Event) => {
        e.preventDefault()
        setError('WebGL 上下文丢失')
        setLoading(false)
      }
      const onContextRestored = () => {
        setError(null)
        setLoading(true)
      }

      canvas.addEventListener('webglcontextlost', onContextLost)
      canvas.addEventListener('webglcontextrestored', onContextRestored)
      cleanup = () => {
        canvas.removeEventListener('webglcontextlost', onContextLost)
        canvas.removeEventListener('webglcontextrestored', onContextRestored)
      }
    }, 500)

    return () => {
      clearTimeout(id)
      cleanup?.()
    }
  }, [isMobile, loading])

  const handleCreated = useCallback((r3fState: { gl: { domElement: HTMLCanvasElement } }) => {
    setLoading(false)
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    canvasRef.current = r3fState.gl.domElement
  }, [])

  const handleError = useCallback(() => {
    setError('WebGL 不支持或已丢失')
    setLoading(false)
  }, [])

  if (error && loading) {
    return <ErrorFallback message={error} />
  }

  if (isMobile || error) {
    return <StaticAvatarFallback state={error ? 'error' : state} />
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-12 h-12 rounded-full border-2 border-[#7c4dff] border-t-transparent animate-spin" />
        </div>
      )}
      <Canvas
        camera={{ position: [0, 1.6, 2.8], fov: 45 }}
        dpr={lowFps ? 1 : Math.min(window.devicePixelRatio, 2)}
        gl={{ alpha: true, antialias: !lowFps, preserveDrawingBuffer: true }}
        style={{ background: 'transparent' }}
        onCreated={handleCreated}
        onError={handleError}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <directionalLight position={[-1, 1, -2]} intensity={0.6} />
        <Suspense fallback={<LoadingFallback />}>
          <DigitalHumanStage
            avatarId={avatarId}
            visemeWeights={visemeWeights}
            state={state}
            onFpsWarning={(warn) => {
              setLowFps(warn)
              onFpsWarning?.(warn)
            }}
            onError={(msg) => {
              setError(msg)
              setLoading(false)
            }}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

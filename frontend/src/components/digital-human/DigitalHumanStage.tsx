'use client'

import { useRef, useEffect, useMemo, Component, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getAvatarUrl } from './avatar-presets'

class ModelLoadErrorBoundary extends Component<
  { onError?: (msg: string) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message || '模型加载失败')
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface DigitalHumanStageProps {
  avatarId: string
  visemeWeights?: Float32Array | null
  state?: 'idle' | 'loading_memory' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'
  onFpsWarning?: (lowFps: boolean) => void
  onError?: (message: string) => void
}

const VISEME_NAMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
]

function AvatarModel({ avatarId, visemeWeights, state = 'idle', onFpsWarning }: DigitalHumanStageProps) {
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Mesh | null>(null)
  const eyeMeshes = useRef<THREE.Mesh[]>([])
  const hairMeshes = useRef<THREE.Mesh[]>([])
  const morphIndices = useRef<Map<string, number>>(new Map())
  const blinkTimer = useRef<number>(0)
  const blinkProgress = useRef<number>(0)
  const blinkActive = useRef<boolean>(false)
  const nextBlink = useRef<number>(3 + Math.random() * 2)
  const glanceTarget = useRef<number>(0)
  const glanceCurrent = useRef<number>(0)
  const nextGlance = useRef<number>(8 + Math.random() * 7)
  const glanceActive = useRef<boolean>(false)
  const fpsFrames = useRef<number[]>([])
  const fpsLowSince = useRef<number>(0)

  const url = getAvatarUrl(avatarId)
  const { scene } = useGLTF(url)

  const model = useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase()

        // 查找头部（带 morph targets）
        if (child.morphTargetDictionary) {
          const dict = child.morphTargetDictionary as Record<string, number>
          morphIndices.current.clear()
          for (const [key, idx] of Object.entries(dict)) {
            morphIndices.current.set(key, idx)
          }
          if (name.includes('head')) {
            headRef.current = child
          }
        }

        // 查找眼睛
        if (name.includes('eye')) {
          eyeMeshes.current.push(child)
        }

        // 查找头发
        if (name.includes('hair') || name.includes('bang')) {
          hairMeshes.current.push(child)
        }
      }
    })

    // 如果没找到名为 head 的 mesh，用第一个有 morph targets 的
    if (!headRef.current) {
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.morphTargetDictionary && !headRef.current) {
          headRef.current = child
        }
      })
    }
  }, [model])

  useFrame((r3fState, delta) => {
    if (!groupRef.current) return
    const clock = r3fState.clock.elapsedTime

    // FPS 监控
    if (delta > 0) {
      fpsFrames.current.push(1 / delta)
      if (fpsFrames.current.length > 60) fpsFrames.current.shift()
      const avgFps = fpsFrames.current.reduce((a, b) => a + b, 0) / fpsFrames.current.length
      const now = performance.now()
      if (avgFps < 30) {
        if (fpsLowSince.current === 0) fpsLowSince.current = now
        else if (now - fpsLowSince.current > 3000) onFpsWarning?.(true)
      } else {
        if (fpsLowSince.current > 0 && now - fpsLowSince.current > 3000) onFpsWarning?.(false)
        fpsLowSince.current = 0
      }
    }

    // 呼吸
    groupRef.current.position.y = Math.sin(clock * 0.8) * 0.02

    // 眨眼
    blinkTimer.current += delta
    if (blinkActive.current) {
      blinkProgress.current += delta * 5
      if (blinkProgress.current >= 1) {
        blinkProgress.current = 0
        blinkActive.current = false
        nextBlink.current = clock + 3 + Math.random() * 2
      }
    } else if (blinkTimer.current >= nextBlink.current) {
      blinkActive.current = true
      blinkProgress.current = 0
      blinkTimer.current = 0
    }

    const blinkWeight = blinkActive.current
      ? (blinkProgress.current < 0.5
        ? blinkProgress.current * 2
        : 2 - blinkProgress.current * 2)
      : 0

    // 环顾
    if (glanceActive.current) {
      glanceCurrent.current = THREE.MathUtils.lerp(glanceCurrent.current, glanceTarget.current, delta * 0.5)
      if (Math.abs(glanceCurrent.current - glanceTarget.current) < 0.01) {
        glanceActive.current = false
        nextGlance.current = clock + 8 + Math.random() * 7
      }
    } else if (clock > nextGlance.current) {
      glanceTarget.current = (Math.random() - 0.5) * 10 * (Math.PI / 180)
      glanceActive.current = true
    }

    // 头部 morph + 旋转
    const head = headRef.current
    if (head) {
      const blinkIdx = morphIndices.current.get('eyesClosed') ?? morphIndices.current.get('blink')
      if (blinkIdx !== undefined && head.morphTargetInfluences) {
        head.morphTargetInfluences[blinkIdx] = blinkWeight
      }

      // Visemes
      if (visemeWeights && head.morphTargetInfluences) {
        for (let i = 0; i < 15; i++) {
          const idx = morphIndices.current.get(VISEME_NAMES[i])
          if (idx !== undefined) {
            head.morphTargetInfluences[idx] = visemeWeights[i]
          }
        }
      }

      // 头部旋转
      let headTargetRot = 0
      if (state === 'listening') {
        headTargetRot = 3 * (Math.PI / 180)
      } else if (state === 'thinking') {
        headTargetRot = 0
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -5 * (Math.PI / 180), delta * 1.5)
      } else if (glanceActive.current) {
        headTargetRot = glanceCurrent.current
      } else {
        headTargetRot = 0
        head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0, delta)
      }
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headTargetRot, delta * 2)

      // 头发跟随头部旋转
      for (const h of hairMeshes.current) {
        h.rotation.y = THREE.MathUtils.lerp(h.rotation.y, headTargetRot, delta * 2)
        h.rotation.x = THREE.MathUtils.lerp(h.rotation.x, head.rotation.x, delta * 2)
      }
    }

    // 眨眼时隐藏眼睛
    const eyeScale = blinkWeight > 0.3 ? 1 - (blinkWeight - 0.3) * 2 : 1
    for (const eye of eyeMeshes.current) {
      eye.scale.y = Math.max(0.01, eyeScale)
    }
  })

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={model} />
    </group>
  )
}

export default function DigitalHumanStage(props: DigitalHumanStageProps) {
  return (
    <ModelLoadErrorBoundary onError={props.onError}>
      <AvatarModel {...props} />
    </ModelLoadErrorBoundary>
  )
}

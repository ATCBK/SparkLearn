'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

const VISEME_SIL = 0
const VISEME_AA = 10
const VISEME_I = 12

const SMOOTH_FACTOR = 0.15

export function useLipSync() {
  const [currentWeights, setCurrentWeights] = useState<Float32Array>(new Float32Array(15))
  const [isActiveState, setIsActiveState] = useState(false)
  const weightsRef = useRef<Float32Array>(new Float32Array(15))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animIdRef = useRef<number>(0)
  const workerRef = useRef<Worker | null>(null)
  const visemeSequence = useRef<Array<{ time: number; strength: number }>>([])
  const ttsStartTime = useRef<number>(0)
  const isActive = useRef(false)

  const startFromAnalyser = useCallback((analyserNode: AnalyserNode) => {
    analyserRef.current = analyserNode
    isActive.current = true
    setIsActiveState(true)
    ttsStartTime.current = performance.now()

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount)

    function tick() {
      if (!isActive.current) return

      if (analyserRef.current) {
        analyserRef.current.getByteTimeDomainData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128
          sum += value * value
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const strength = Math.min(1, rms * 7)

        const weights = weightsRef.current
        const targetAA = strength > 0.1 ? strength : 0
        const targetI = strength > 0.1 ? strength * 0.5 : 0

        weights[VISEME_SIL] = weightLerp(weights[VISEME_SIL], strength < 0.1 ? 1 : 0, 0.2)
        weights[VISEME_AA] = weightLerp(weights[VISEME_AA], targetAA, SMOOTH_FACTOR)
        weights[VISEME_I] = weightLerp(weights[VISEME_I], targetI, SMOOTH_FACTOR)

        setCurrentWeights(new Float32Array(weights))
      }

      animIdRef.current = requestAnimationFrame(tick)
    }

    animIdRef.current = requestAnimationFrame(tick)
  }, [])

  const startFromAudioData = useCallback((audioData: Float32Array, sampleRate: number) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/lip-sync.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }

    isActive.current = true
    setIsActiveState(true)
    ttsStartTime.current = performance.now()
    visemeSequence.current = []

    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'viseme') {
        visemeSequence.current.push({
          time: e.data.timestamp,
          strength: e.data.strength,
        })
      } else if (e.data.type === 'done') {
        // Worker analysis complete
      }
    }

    workerRef.current.postMessage({ type: 'analyse', audioData, sampleRate })

    let lastIdx = 0
    function playbackTick() {
      if (!isActive.current) return

      const elapsed = performance.now() - ttsStartTime.current
      const seq = visemeSequence.current

      // Find the current viseme frame
      let strength = 0
      for (let i = lastIdx; i < seq.length; i++) {
        if (seq[i].time <= elapsed) {
          strength = seq[i].strength
          lastIdx = i
        } else {
          break
        }
      }

      const weights = weightsRef.current
      const targetAA = strength > 0.1 ? strength : 0
      const targetI = strength > 0.1 ? strength * 0.5 : 0

      weights[VISEME_SIL] = weightLerp(weights[VISEME_SIL], strength < 0.1 ? 1 : 0, 0.2)
      weights[VISEME_AA] = weightLerp(weights[VISEME_AA], targetAA, SMOOTH_FACTOR)
      weights[VISEME_I] = weightLerp(weights[VISEME_I], targetI, SMOOTH_FACTOR)

      setCurrentWeights(new Float32Array(weights))

      animIdRef.current = requestAnimationFrame(playbackTick)
    }

    animIdRef.current = requestAnimationFrame(playbackTick)
  }, [])

  const stop = useCallback(() => {
    isActive.current = false
    setIsActiveState(false)
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current)
      animIdRef.current = 0
    }
    analyserRef.current = null

    // Smoothly return to silence
    const weights = weightsRef.current
    weights[VISEME_SIL] = 1
    for (let i = 1; i < 15; i++) {
      weights[i] = 0
    }
    setCurrentWeights(new Float32Array(weights))
  }, [])

  useEffect(() => {
    return () => {
      stop()
      workerRef.current?.terminate()
    }
  }, [stop])

  return {
    currentWeights,
    isActive: isActiveState,
    startFromAnalyser,
    startFromAudioData,
    stop,
  }
}

function weightLerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor
}

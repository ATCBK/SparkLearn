// Web Worker for audio amplitude analysis.
// Receives Float32Array audio data, computes RMS amplitude in 50ms windows (20fps).

interface AnalyseMessage {
  type: 'analyse'
  audioData: Float32Array
  sampleRate: number
}

interface VisemeResult {
  type: 'viseme'
  timestamp: number
  strength: number
  windowMs: number
}

interface DoneResult {
  type: 'done'
}

type WorkerMessage = AnalyseMessage
type WorkerResponse = VisemeResult | DoneResult

function computeRMS(samples: Float32Array, start: number, end: number): number {
  let sum = 0
  let count = 0
  for (let i = start; i < end && i < samples.length; i++) {
    sum += samples[i] * samples[i]
    count++
  }
  if (count === 0) return 0
  return Math.sqrt(sum / count)
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  if (msg.type !== 'analyse') return

  const { audioData, sampleRate } = msg
  const windowMs = 50
  const windowSamples = Math.floor(sampleRate * (windowMs / 1000))
  const totalSamples = audioData.length

  // Normalize: find peak value for scaling
  let peak = 0
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(audioData[i])
    if (abs > peak) peak = abs
  }

  if (peak === 0) {
    self.postMessage({ type: 'done' } as DoneResult)
    return
  }

  for (let offset = 0; offset < totalSamples; offset += windowSamples) {
    const rms = computeRMS(audioData, offset, offset + windowSamples)
    // Normalize strength: map RMS to 0-1 range
    const normalizedRms = rms / peak
    // Apply a curve to make it more responsive
    const strength = Math.min(1, normalizedRms * 3.5)

    self.postMessage({
      type: 'viseme',
      timestamp: (offset / sampleRate) * 1000,
      strength,
      windowMs,
    } as VisemeResult)
  }

  self.postMessage({ type: 'done' } as DoneResult)
}

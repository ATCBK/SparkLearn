import type { TutorStreamEvent } from '../types/tutor'

export function parseSseChunk(input: string) {
  const events: TutorStreamEvent[] = []
  const restParts = input.split(/\n\n/)
  const rest = input.endsWith('\n\n') ? '' : restParts.pop() || ''

  restParts.forEach((block) => {
    const dataLines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))

    const raw = dataLines.join('\n').trim()
    if (!raw || raw === '[DONE]') {
      return
    }

    try {
      events.push(JSON.parse(raw))
    } catch {
      events.push({ type: 'text', payload: { content: raw } })
    }
  })

  return { events, rest }
}

export function decodeArrayBuffer(buffer: ArrayBuffer) {
  try {
    const Decoder = (globalThis as any).TextDecoder
    if (Decoder) {
      return new Decoder('utf-8').decode(buffer)
    }
  } catch {
    // Fall through to the compact UTF-8 fallback below.
  }

  const bytes = Array.from(new Uint8Array(buffer))
  const encoded = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('')
  try {
    return decodeURIComponent(encoded)
  } catch {
    return String.fromCharCode(...bytes)
  }
}

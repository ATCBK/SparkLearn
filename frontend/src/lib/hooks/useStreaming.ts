'use client'

import { useState, useCallback } from 'react'

export function useStreaming(url: string) {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const startStream = useCallback(async (body: Record<string, unknown>) => {
    setIsStreaming(true)
    setText('')

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.body) {
        setIsStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setText(prev => prev + chunk)
      }
    } finally {
      setIsStreaming(false)
    }
  }, [url])

  const reset = useCallback(() => {
    setText('')
    setIsStreaming(false)
  }, [])

  return { text, isStreaming, startStream, reset }
}

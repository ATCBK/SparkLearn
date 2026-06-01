'use client'

import { useState, useRef } from 'react'
import { Mic, MicOff, Send } from 'lucide-react'

interface DigitalHumanControlBarProps {
  onSend: (text: string) => void
  onStartListening: () => void
  onStopListening: () => void
  isListening: boolean
  isDisabled: boolean
  asrSupported: boolean
}

export default function DigitalHumanControlBar({
  onSend,
  onStartListening,
  onStopListening,
  isListening,
  isDisabled,
  asrSupported,
}: DigitalHumanControlBarProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const text = input.trim()
    if (!text || isDisabled) return
    onSend(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleMicClick() {
    if (isListening) {
      onStopListening()
    } else {
      onStartListening()
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-white/8">
      {asrSupported && (
        <button
          type="button"
          onClick={handleMicClick}
          disabled={isDisabled && !isListening}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title={isListening ? '停止录音' : '语音输入'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}

      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={isListening ? '正在聆听...' : '输入你想问的...'}
        className="flex-1 min-w-0 bg-white/6 border border-white/10 rounded-full px-4 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-white/20 focus:bg-white/8 transition-colors disabled:opacity-30"
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={isDisabled || !input.trim()}
        className="shrink-0 w-9 h-9 rounded-full bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="发送"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}

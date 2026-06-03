'use client'

import { useEffect, useRef } from 'react'
import type { DHMessage } from './hooks/useDigitalHuman'

interface DigitalHumanChatProps {
  messages: DHMessage[]
  isThinking: boolean
}

export default function DigitalHumanChat({ messages, isThinking }: DigitalHumanChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking])

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
      style={{ scrollBehavior: 'smooth' }}
    >
      {messages.length === 0 && !isThinking && (
        <div className="text-center text-[#9ca3af] text-sm py-8">
          有什么问题可以问我
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#2563eb] text-white rounded-br-md'
                : 'bg-[#f3f4f6] text-[#111827] rounded-bl-md border border-gray-100'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isThinking && (
        <div className="flex justify-start">
          <div className="bg-[#f3f4f6] text-[#6b7280] rounded-2xl rounded-bl-md px-3 py-2 border border-gray-100">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db] animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db] animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db] animate-bounce" style={{ animationDelay: '0.3s' }} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

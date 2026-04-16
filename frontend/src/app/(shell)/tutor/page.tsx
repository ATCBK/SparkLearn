'use client'

import { useEffect, useState, useRef } from 'react'
import { api, Message } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/ErrorState'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { Send, Mic } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getChatHistory()
      setMessages(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || streaming) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    try {
      const response = await api.sendMessage(input)
      setMessages(prev => [...prev, response])
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，发生了错误，请重试。',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setStreaming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <TypewriterLoader text="正在加载对话..." />
      </div>
    )
  }
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      <div className="mb-4">
        <h1 className="text-h1 text-ink">智能辅导</h1>
        <p className="text-body text-ink-secondary mt-1">随时向 AI 提问，获得即时解答</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[70%] rounded-[16px] px-5 py-3',
              msg.role === 'user'
                ? 'bg-blue text-white'
                : 'bg-bg-card shadow-sm border border-black/[0.04]',
            )}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-body">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="bg-bg-card shadow-sm border border-black/[0.04] rounded-[16px] px-5 py-4">
              <TypewriterLoader />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="mt-4 bg-bg-card rounded-[16px] shadow-sm border border-black/[0.06] p-3 flex items-end gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="请输入你的问题..."
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent text-body text-ink placeholder:text-ink-disabled focus:outline-none min-h-[24px] max-h-[120px]"
        />
        <button className="w-9 h-9 rounded-full bg-bg-hover flex items-center justify-center text-ink-secondary hover:text-ink transition-colors shrink-0">
          <Mic className="w-4 h-4" />
        </button>
        <Button onClick={handleSend} disabled={!input.trim() || streaming} size="sm">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

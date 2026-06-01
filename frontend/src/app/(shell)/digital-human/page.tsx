'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2, MessageSquare, Play, Send, Video } from 'lucide-react'
import { api, VideoInfo } from '@/lib/api'
import DigitalHumanScene from '@/components/digital-human/DigitalHumanScene'
import DigitalHumanChat from '@/components/digital-human/DigitalHumanChat'
import type { DHMessage } from '@/components/digital-human/hooks/useDigitalHuman'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

type MemoryState = {
  memoryId: string
  videoTitle: string
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    const detail = typeof json.detail === 'string' ? json.detail : ''
    throw new Error(json.error || detail || `Request failed: ${res.status}`)
  }
  return json.data as T
}

async function readSse(
  path: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((item) => item.startsWith('data: '))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as { type: string; payload: Record<string, unknown> }
      if (event.type === 'token') onToken(String(event.payload.text || ''))
      if (event.type === 'error') throw new Error(String(event.payload.message || 'Digital human chat failed'))
    }
  }
}

export default function DigitalHumanPage() {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [memory, setMemory] = useState<MemoryState | null>(null)
  const [messages, setMessages] = useState<DHMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(
    () => videos.find((item) => item.id === selectedId) || videos[0] || null,
    [videos, selectedId],
  )

  async function loadVideos() {
    try {
      setLoading(true)
      setError('')
      const data = await api.getVideos()
      setVideos(data)
      const initialVideoId = new URLSearchParams(window.location.search).get('video') || ''
      setSelectedId((prev) => prev || initialVideoId || data[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVideos()
  }, [])

  async function loadMemory(video: VideoInfo) {
    try {
      setMemoryLoading(true)
      setError('')
      const data = await fetchJson<{ memory_id: string; video_title: string; greeting: string }>(
        '/api/num-person/memory/load',
        {
          method: 'POST',
          body: JSON.stringify({ video_id: video.id, user_id: 'single_user' }),
        },
      )
      setMemory({ memoryId: data.memory_id, videoTitle: data.video_title })
      setMessages([{ role: 'assistant', content: data.greeting }])
    } catch (err) {
      setMemory(null)
      setMessages([])
      setError(err instanceof Error ? err.message : 'Failed to load digital human memory')
    } finally {
      setMemoryLoading(false)
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || !memory || thinking) return
    setInput('')
    setThinking(true)
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    try {
      await readSse(
        '/api/num-person/chat',
        {
          memory_id: memory.memoryId,
          message: text,
          history: messages,
        },
        (token) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + token }
            }
            return next
          })
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Digital human chat failed')
    } finally {
      setThinking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[520px] w-full rounded-[16px]" />
      </div>
    )
  }

  if (error && videos.length === 0) return <ErrorState type="server" onRetry={loadVideos} />

  if (videos.length === 0) {
    return (
      <EmptyState
        type="resources"
        title="还没有可学习的视频"
        description="先在资源中心生成一个教学视频，数字人会基于视频脚本进行问答。"
        action={{ label: '去生成视频', href: '/generate' }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-line pb-4 min-[900px]:flex-row min-[900px]:items-end min-[900px]:justify-between">
        <div>
          <div className="mb-2 text-small font-extrabold text-soft">数字人 / 视频记忆问答</div>
          <h1 className="m-0 text-h1 font-bold text-ink">数字人学习伙伴</h1>
          <p className="mt-2 max-w-[760px] text-body leading-7 text-muted">
            选择一个已生成的视频，加载脚本记忆后，数字人会围绕视频内容回答问题。
          </p>
        </div>
        <Link href="/video" className="inline-flex items-center gap-2 text-small font-bold text-blue">
          <Video className="h-4 w-4" />
          视频中心
        </Link>
      </header>

      {error && (
        <div className="rounded-[10px] border border-red/30 bg-red-light px-4 py-3 text-small text-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[320px_1fr] gap-4 max-[980px]:grid-cols-1">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-small font-bold text-ink">
            <Play className="h-4 w-4 text-blue" />
            选择视频
          </div>
          <div className="space-y-2">
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => {
                  setSelectedId(video.id)
                  setMemory(null)
                  setMessages([])
                }}
                className={`w-full rounded-[10px] border p-3 text-left transition-colors ${
                  selected?.id === video.id ? 'border-blue bg-blue-light' : 'border-line bg-white hover:border-blue'
                }`}
              >
                <b className="line-clamp-1 text-small text-ink">{video.title}</b>
                <span className="mt-1 block text-micro text-muted">{video.createdAt || video.id}</span>
              </button>
            ))}
          </div>
          <Button
            className="mt-4 w-full"
            disabled={!selected || memoryLoading}
            onClick={() => selected && loadMemory(selected)}
          >
            {memoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            加载数字人记忆
          </Button>
        </Card>

        <div className="grid grid-cols-[minmax(280px,420px)_1fr] gap-4 max-[1180px]:grid-cols-1">
          <Card className="h-[520px] overflow-hidden bg-[#0f172a]">
            <DigitalHumanScene state={thinking ? 'thinking' : memory ? 'ready' : 'idle'} />
          </Card>

          <Card className="flex h-[520px] flex-col overflow-hidden p-0">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-small font-bold text-ink">
                <MessageSquare className="h-4 w-4 text-blue" />
                {memory ? memory.videoTitle : '请先加载视频记忆'}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <DigitalHumanChat messages={messages} isThinking={thinking} />
            </div>
            <div className="border-t border-line p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void sendMessage()
                  }}
                  disabled={!memory || thinking}
                  placeholder={memory ? '围绕这个视频提问...' : '先加载数字人记忆'}
                  className="min-w-0 flex-1 rounded-[10px] border border-line px-3 text-small outline-none focus:border-blue"
                />
                <Button disabled={!memory || !input.trim() || thinking} onClick={() => void sendMessage()}>
                  <Send className="h-4 w-4" />
                  发送
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

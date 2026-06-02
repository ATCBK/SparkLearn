'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api, VideoInfo } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Play, Clock, Download, Share2, Trash2, ArrowLeft, MessageCircle, Video, Bot } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDuration } from '@/lib/utils/format'
import DigitalHumanLive from '@/components/digital-human/DigitalHumanLive'
import DigitalHumanChat from '@/components/digital-human/DigitalHumanChat'
import DigitalHumanControlBar from '@/components/digital-human/DigitalHumanControlBar'
import { useDigitalHuman } from '@/components/digital-human/hooks/useDigitalHuman'
import { useTTS } from '@/components/digital-human/hooks/useTTS'
import { useASR } from '@/components/digital-human/hooks/useASR'
import { useParticleBackground } from '@/components/digital-human/hooks/useParticleBackground'

export default function VideoPage() {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selected, setSelected] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dhOpen, setDhOpen] = useState(false)
  const [lowFps, setLowFps] = useState(false)

  const pageRef = useRef<HTMLDivElement>(null)
  const dhContainerRef = useRef<HTMLDivElement>(null)
  const { speak, stop: stopTts, getAnalyser, isSupported: ttsSupported } = useTTS()
  const asr = useASR({
    onResult: (text) => {
      dh.stopListening()
      handleSend(text)
    },
    onError: () => { /* handled by asr.isSupported */ },
  })

  const dh = useDigitalHuman()

  useParticleBackground(dhContainerRef, !lowFps)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getVideos()
      setVideos(data)
      if (data.length > 0) setSelected(data[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Load memory when video is selected
  useEffect(() => {
    if (!selected) return
    const videoId = selected.id
    if (dh.currentVideoId === videoId) return

    dh.loadMemory(videoId)
    api.loadMemory(videoId)
      .then(result => {
        dh.onMemoryLoaded(videoId, result.video_title, result.memory_id, result.greeting)
      })
      .catch(e => {
        dh.onMemoryError(e instanceof Error ? e.message : '记忆加载失败')
      })
  }, [selected?.id])

  async function handleSend(text: string) {
    const memoryId = dh.currentMemoryId
    if (!memoryId) return

    dh.sendMessage(text)

    // Clean history for API (only role + content)
    const history = dh.messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const fullText = await api.chatWithDigitalHuman(
        memoryId,
        text,
        history,
        (evt) => {
          if (evt.type === 'token') {
            dh.onToken(String(evt.payload.text || ''))
          }
        },
      )

      // Speak response
      dh.startSpeaking()
      speak(fullText, { lang: 'zh-CN', rate: 1.0 }, {
        onEnd: () => {
          dh.doneSpeaking()
        },
        onError: () => {
          dh.doneSpeaking()
        },
      })
    } catch (e) {
      dh.setError(e instanceof Error ? e.message : '对话失败')
    }
  }

  const handleMicClick = useCallback(() => {
    if (asr.isListening) {
      asr.stopListening()
      dh.stopListening()
    } else {
      dh.startListening()
      asr.startListening()
    }
  }, [asr, dh])

  async function handleDelete(video: VideoInfo) {
    if (!window.confirm(`确定删除"${video.title}"吗？删除后会清理视频、音频、字幕和时间轴文件。`)) return
    try {
      setDeletingId(video.id)
      await api.deleteVideoResource(video.id)
      const next = videos.filter(item => item.id !== video.id)
      setVideos(next)
      if (selected?.id === video.id) {
        const newSelected = next[0] || null
        setSelected(newSelected)
        if (dh.currentMemoryId) {
          api.deleteMemory(dh.currentMemoryId).catch(() => {})
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-36" />
        <div className="grid grid-cols-[220px_1fr_340px] gap-4 max-[1180px]:grid-cols-[200px_1fr] max-[820px]:grid-cols-1">
          <Skeleton className="h-[420px] rounded-[12px]" />
          <Skeleton className="aspect-video rounded-[12px]" />
          <Skeleton className="h-[520px] rounded-[12px] max-[1180px]:hidden" />
        </div>
      </div>
    )
  }

  if (error) return <ErrorState type="server" onRetry={fetchData} />

  const dhState = dh.state
  const isSpeakingOrThinking = dhState === 'speaking' || dhState === 'thinking'

  const dhPanel = (
    <div className="flex h-full flex-col bg-[#111827]" ref={dhContainerRef}>
      {/* Status */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-white/60">
          {dhState === 'loading_memory' ? '正在学习视频...' :
           dhState === 'ready' || dhState === 'speaking' || dhState === 'thinking' || dhState === 'listening'
            ? `在线 · 已学习${dh.currentVideoTitle ? `《${dh.currentVideoTitle}》` : '当前视频'}`
            : dhState === 'error' ? '出错了' : '在线'}
        </span>
      </div>

      {/* Avatar - DH_live 2D数字人 */}
      <div className="relative h-[300px] shrink-0">
        <DigitalHumanLive
          className="w-full h-full"
          onReady={() => console.log('数字人就绪')}
          onError={(msg) => console.error('数字人错误:', msg)}
        />
      </div>

      {/* Chat */}
      <DigitalHumanChat messages={dh.messages} isThinking={dhState === 'thinking'} />

      {/* Error */}
      {dh.error && (
        <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">
          {dh.error}
          <button onClick={dh.retry} className="ml-2 underline hover:text-red-300">重试</button>
        </div>
      )}

      {/* Control */}
      <DigitalHumanControlBar
        onSend={handleSend}
        onStartListening={handleMicClick}
        onStopListening={handleMicClick}
        isListening={asr.isListening}
        isDisabled={isSpeakingOrThinking || dhState === 'loading_memory'}
        asrSupported={asr.isSupported}
      />
    </div>
  )

  return (
    <div ref={pageRef} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/generate?view=library" className="mb-3 inline-flex items-center gap-2 text-small font-bold text-blue transition-colors hover:text-blue-dark">
            <ArrowLeft className="h-4 w-4" />返回资源中心
          </Link>
          <h1 className="text-h1 text-ink">视频播放</h1>
          <p className="mt-1 text-body text-muted">观看课程视频，和数字人一起复盘讲解内容。</p>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchData}>
          刷新列表
        </Button>
      </div>

      {videos.length === 0 ? (
        <EmptyState type="resources" title="还没有视频" description="前往资源生成页面创建视频" action={{ label: '去生成', href: '/generate' }} />
      ) : (
        <div className="grid h-[calc(100vh-168px)] min-h-[620px] grid-cols-[220px_minmax(0,1fr)_340px] gap-4 max-[1180px]:grid-cols-[220px_minmax(0,1fr)] max-[900px]:h-auto max-[900px]:min-h-0 max-[900px]:grid-cols-1 max-[900px]:pb-24">
          {/* Column 1: Video List */}
          <Card className="overflow-hidden rounded-[12px] border border-line bg-white shadow-sm">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-small font-bold text-ink">全部视频</h2>
                <span className="rounded-full bg-blue-light px-2 py-0.5 text-micro font-bold text-blue">{videos.length}</span>
              </div>
            </div>
            <div className="max-h-full space-y-2 overflow-y-auto p-3 max-[900px]:grid max-[900px]:max-h-none max-[900px]:grid-cols-2 max-[620px]:grid-cols-1">
              {videos.map(video => {
                const active = selected?.id === video.id
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelected(video)}
                    className={cn(
                      'w-full rounded-[10px] border p-3 text-left transition-all',
                      active
                        ? 'border-blue bg-blue-light shadow-sm'
                        : 'border-line bg-white hover:border-blue/50 hover:bg-[#f8fafc]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
                        active ? 'bg-blue text-white' : 'bg-[#eff6ff] text-blue',
                      )}>
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-small font-bold text-ink">{video.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-micro text-muted">
                          <Clock className="h-3 w-3" />
                          {formatDuration(Math.round(video.duration / 60))}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Column 2: Video Player */}
          <div className="min-w-0 space-y-4 overflow-y-auto pr-1 max-[900px]:overflow-visible max-[900px]:pr-0">
            {selected && (
              <>
                <Card className="overflow-hidden rounded-[12px] border border-line bg-white shadow-sm">
                  <div className="aspect-video bg-[#0b1220]">
                    {selected.hasMp4 && selected.url ? (
                      <video src={selected.url} controls preload="metadata" className="h-full w-full" />
                    ) : selected.sceneUrl ? (
                      <iframe
                        src={selected.sceneUrl}
                        className="h-full w-full bg-white"
                        title={`${selected.title} 场景预览`}
                      />
                    ) : selected.url ? (
                      <video src={selected.url} controls preload="metadata" className="h-full w-full" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-white/70">
                        <div>
                          <Video className="mx-auto mb-4 h-14 w-14 opacity-60" />
                          <p className="text-body font-bold">视频播放区域</p>
                          <p className="mt-1 text-caption text-white/45">{selected.title}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[12px] border border-line bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2.5 py-1 text-micro font-bold text-blue">
                        <Video className="h-3.5 w-3.5" />视频资源
                      </span>
                      <h2 className="mt-3 text-h3 text-ink">{selected.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-caption text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(Math.round(selected.duration / 60))}
                        </span>
                        <span>{selected.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => api.downloadVideoArtifact(selected.id, 'mp4')}>
                        <Download className="h-4 w-4" />
                        下载视频
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const link = selected.shareUrl || selected.sceneUrl || selected.url
                          if (link) navigator.clipboard?.writeText(link)
                        }}
                      >
                        <Share2 className="h-4 w-4" />
                        分享
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(selected)} disabled={deletingId === selected.id} className="text-red hover:bg-red-light hover:text-red">
                        <Trash2 className="h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Column 3: Digital Human - Desktop */}
          <Card className="hidden overflow-hidden rounded-[12px] border border-line bg-white shadow-sm lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#eff6ff] text-blue">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-small font-bold text-ink">数字人陪学</h2>
                  <p className="text-micro text-muted">基于当前视频回答问题</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {dhPanel}
            </div>
          </Card>

          {/* Mobile: Floating Digital Human button + overlay */}
          <div className="fixed bottom-24 right-5 z-[80] lg:hidden">
            <button
              onClick={() => setDhOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-blue text-white shadow-lg shadow-blue/25 transition-transform hover:scale-105"
              aria-label="打开数字人陪学"
            >
              <MessageCircle className="h-6 w-6" />
            </button>

            {dhOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 bg-white px-4 py-3">
                  <span className="text-small font-bold text-ink">数字人陪学</span>
                  <button onClick={() => setDhOpen(false)} className="rounded-[8px] px-3 py-1.5 text-small font-bold text-muted hover:bg-bg-hover hover:text-ink">
                    关闭
                  </button>
                </div>
                <div className="m-4 min-h-0 flex-1 overflow-hidden rounded-[12px] border border-white/10 bg-[#111827] shadow-xl">
                  {dhPanel}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

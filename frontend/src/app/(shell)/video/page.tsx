'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api, VideoInfo } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Play, Clock, Download, Share2, Trash2, ArrowLeft, MessageCircle } from 'lucide-react'
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
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-video w-full rounded-[20px]" />
      </div>
    )
  }

  if (error) return <ErrorState type="server" onRetry={fetchData} />

  const dhState = dh.state
  const isSpeakingOrThinking = dhState === 'speaking' || dhState === 'thinking'

  const dhPanel = (
    <div className="flex flex-col h-full" ref={dhContainerRef}>
      {/* Status */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-white/60">
          {dhState === 'loading_memory' ? '正在学习视频...' :
           dhState === 'ready' || dhState === 'speaking' || dhState === 'thinking' || dhState === 'listening'
            ? `在线 · 已学习${dh.currentVideoTitle ? `《${dh.currentVideoTitle}》` : '当前视频'}`
            : dhState === 'error' ? '出错了' : '在线'}
        </span>
      </div>

      {/* Avatar - DH_live 2D数字人 */}
      <div className="relative h-[320px] shrink-0">
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
    <div
      ref={pageRef}
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}
    >
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4">
          <Link href="/generate?view=library" className="flex items-center gap-2 text-[#60a5fa] hover:text-[#93bbfd] transition-colors text-sm font-bold">
            <ArrowLeft className="h-4 w-4" />返回资源中心
          </Link>
        </div>
        <div>
          <h1 className="text-h1 text-white/90">视频播放</h1>
          <p className="text-body text-white/50 mt-1">观看课程视频，提升学习效果</p>
        </div>

        {videos.length === 0 ? (
          <EmptyState type="resources" title="还没有视频" description="前往资源生成页面创建视频" action={{ label: '去生成', href: '/generate' }} />
        ) : (
          <div className="flex gap-4 h-[calc(100vh-180px)]">
            {/* Column 1: Video List */}
            <div className="w-40 shrink-0 overflow-y-auto space-y-2">
              <h3 className="text-xs font-semibold text-white/40 mb-2 px-1">全部视频</h3>
              {videos.map(video => (
                <Card
                  key={video.id}
                  hoverable
                  className={cn(
                    'p-3 cursor-pointer transition-all border-white/5',
                    selected?.id === video.id && 'ring-2 ring-[#60a5fa] bg-white/8',
                  )}
                  onClick={() => setSelected(video)}
                  style={{ background: selected?.id === video.id ? undefined : 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2563eb]/20 flex items-center justify-center text-[#60a5fa] shrink-0">
                      <Play className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{video.title}</p>
                      <p className="text-[10px] text-white/30">
                        {formatDuration(Math.round(video.duration / 60))}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Column 2: Video Player */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
              {selected && (
                <>
                  <Card className="overflow-hidden border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="aspect-video bg-black">
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
                        <div className="flex h-full items-center justify-center text-center text-white/40">
                          <div>
                            <Play className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="text-body">视频播放区域</p>
                            <p className="text-caption mt-1">{selected.title}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="p-5 border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-h3 text-white/90">{selected.title}</h2>
                        <div className="flex items-center gap-4 mt-2 text-caption text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
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
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(selected)} disabled={deletingId === selected.id}>
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
            <div className="hidden lg:flex w-[360px] shrink-0 flex-col rounded-[20px] overflow-hidden border border-white/8 backdrop-blur-[20px]"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              {dhPanel}
            </div>

            {/* Mobile: Floating Digital Human button + overlay */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
              <button
                onClick={() => setDhOpen(true)}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7c4dff] to-[#4fc3f7] shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
              >
                <MessageCircle className="w-6 h-6" />
              </button>

              {dhOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <span className="text-white/80 text-sm font-medium">AI 学习伴侣</span>
                    <button onClick={() => setDhOpen(false)} className="text-white/60 hover:text-white text-sm px-3 py-1">
                      关闭
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 rounded-[20px] overflow-hidden border border-white/8 m-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    {dhPanel}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

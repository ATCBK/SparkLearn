'use client'

import { useEffect, useState } from 'react'
import { api, VideoInfo } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Play, Clock, Download, Volume2, Subtitles, Share2, ExternalLink, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDuration } from '@/lib/utils/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function VideoPage() {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selected, setSelected] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function handleDelete(video: VideoInfo) {
    if (!window.confirm(`确定删除“${video.title}”吗？删除后会清理视频、音频、字幕和时间轴文件。`)) return
    try {
      setDeletingId(video.id)
      await api.deleteVideoResource(video.id)
      const next = videos.filter(item => item.id !== video.id)
      setVideos(next)
      if (selected?.id === video.id) setSelected(next[0] || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-video w-full rounded-[20px]" />
      </div>
    )
  }
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#f3efff] text-[#7c3aed]">
            <Play className="h-4 w-4" />
          </div>
          <h1 className="text-h1 text-ink">视频播放</h1>
        </div>
        <p className="text-body text-ink-secondary mt-1">观看课程视频，提升学习效果</p>
      </div>

      {videos.length === 0 ? (
        <EmptyState type="resources" title="还没有视频" description="前往资源生成页面创建视频" action={{ label: '去生成', href: '/generate' }} />
      ) : (
        <>
          {/* Video Player */}
          {selected && (
            <Card className="overflow-hidden">
              <div className="aspect-video bg-ink">
                {selected.hasMp4 && selected.url ? (
                  <video src={selected.url} controls preload="metadata" className="h-full w-full bg-black" />
                ) : selected.sceneUrl ? (
                  <iframe
                    src={selected.sceneUrl}
                    className="h-full w-full bg-white"
                    title={`${selected.title} 场景预览`}
                  />
                ) : selected.url ? (
                  <video src={selected.url} controls preload="metadata" className="h-full w-full bg-black" />
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white/60">
                    <div>
                      <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-body">视频播放区域</p>
                      <p className="text-caption mt-1">{selected.title}</p>
                    </div>
                  </div>
                )}
              </div>
              {selected.audioUrl && (
                <div className="border-t border-black/[0.06] bg-bg-card p-4">
                  <div className="mb-2 flex items-center gap-2 text-small font-medium text-ink">
                    <Volume2 className="h-4 w-4 text-blue" />
                    语音播报
                  </div>
                  <audio src={selected.audioUrl} controls className="w-full" />
                </div>
              )}
            </Card>
          )}

          {/* Video Info */}
          {selected && (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-h3 text-ink">{selected.title}</h2>
                  <div className="flex items-center gap-4 mt-2 text-caption text-ink-tertiary">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(Math.round(selected.duration / 60))}
                    </span>
                    <span>{selected.createdAt}</span>
                    {selected.ttsProvider && <Badge variant="info" size="sm">{selected.ttsProvider}</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => api.downloadVideoArtifact(selected.id, 'mp4')}>
                    <Download className="h-4 w-4" />
                    {selected.hasMp4 ? '下载MP4' : '下载生成清单'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => api.downloadVideoArtifact(selected.id, 'audio')} disabled={!selected.audioUrl}>
                    <Volume2 className="h-4 w-4" />
                    音频
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => api.downloadVideoArtifact(selected.id, 'srt')} disabled={!selected.subtitleUrl}>
                    <Subtitles className="h-4 w-4" />
                    字幕
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
                  <Button size="sm" variant="ghost" onClick={() => selected.sceneUrl && window.open(selected.sceneUrl, '_blank', 'noopener,noreferrer')} disabled={!selected.sceneUrl}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(selected)} disabled={deletingId === selected.id}>
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>
              {selected.provider && (
                <p className="mt-4 text-small text-ink-secondary">
                  生成方式：{selected.provider}。{selected.muxMessage || '未配置 FFmpeg 或商用视频 Provider 时，此页展示场景预览、语音播报、字幕与时间轴产物。'}
                </p>
              )}
            </Card>
          )}

          {/* Video List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#f3efff] text-[#7c3aed]">
                <Play className="h-4 w-4" />
              </div>
              <h3 className="text-small font-semibold text-ink">全部视频</h3>
            </div>
            {videos.map(video => (
              <Card
                key={video.id}
                hoverable
                className={cn(
                  'p-4 flex items-center gap-4',
                  selected?.id === video.id && 'ring-2 ring-blue',
                )}
                onClick={() => setSelected(video)}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f3efff] text-[#7c3aed]">
                  <Play className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink truncate">{video.title}</p>
                  <p className="text-caption text-ink-tertiary">
                    {formatDuration(Math.round(video.duration / 60))} · {video.createdAt}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDelete(video)
                  }}
                  disabled={deletingId === video.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

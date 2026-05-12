'use client'

import { useEffect, useState } from 'react'
import { api, VideoInfo } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Play, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDuration } from '@/lib/utils/format'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'

export default function VideoPage() {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selected, setSelected] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <TypewriterLoader text="加载视频中..." />
      </div>
    )
  }
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">视频播放</h1>
        <p className="text-body text-ink-secondary mt-1">观看课程视频，提升学习效果</p>
      </div>

      {videos.length === 0 ? (
        <EmptyState type="resources" title="还没有视频" description="前往资源生成页面创建视频" action={{ label: '去生成', href: '/generate' }} />
      ) : (
        <>
          {/* Video Player */}
          {selected && (
            <Card className="overflow-hidden">
              <div className="aspect-video bg-ink flex items-center justify-center">
                <div className="text-center text-white/60">
                  <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-body">视频播放区域</p>
                  <p className="text-caption mt-1">{selected.title}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Video Info */}
          {selected && (
            <Card className="p-5">
              <h2 className="text-h3 text-ink">{selected.title}</h2>
              <div className="flex items-center gap-4 mt-2 text-caption text-ink-tertiary">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(Math.round(selected.duration / 60))}
                </span>
                <span>{selected.createdAt}</span>
              </div>
            </Card>
          )}

          {/* Video List */}
          <div className="space-y-2">
            <h3 className="text-small font-semibold text-ink mb-2">全部视频</h3>
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
                <div className="w-10 h-10 rounded-lg bg-blue-light flex items-center justify-center text-blue shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink truncate">{video.title}</p>
                  <p className="text-caption text-ink-tertiary">
                    {formatDuration(Math.round(video.duration / 60))} · {video.createdAt}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

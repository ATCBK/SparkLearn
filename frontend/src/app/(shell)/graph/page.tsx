// Python 知识图谱页面
'use client'

import { useEffect } from 'react'
import { BookOpen, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { useGraphStore } from './store/graphStore'
import { PageHead } from '@/components/proto'
import { GraphToolbar } from './components/GraphToolbar'
import { GraphCanvas } from './components/GraphCanvas'
import { DetailPanel } from './components/DetailPanel'
import { cn } from '@/lib/utils/cn'

export default function GraphPage() {
  const graphData = useGraphStore((s) => s.graphData)
  const isFullscreen = useGraphStore((s) => s.isFullscreen)
  const loadData = useGraphStore((s) => s.loadData)

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = graphData?.stats

  return (
    <div className={cn(isFullscreen && 'fixed inset-0 z-50 bg-bg p-4 overflow-auto')}>
      {/* 页面头部 */}
      <PageHead
        eyebrow="学习中心 > 知识图谱"
        title="Python 知识图谱"
        description="基于你的学习画像，AI 生成的个性化知识网络"
        chips={
          stats
            ? [
                { value: String(stats.total), label: '总知识点', icon: <BookOpen className="h-4 w-4" />, tone: 'blue' },
                { value: String(stats.mastered), label: '已掌握', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'green' },
                { value: String(stats.learning), label: '学习中', icon: <Loader2 className="h-4 w-4" />, tone: 'blue' },
                { value: String(stats.not_started + stats.locked), label: '未学习', icon: <Lock className="h-4 w-4" />, tone: 'orange' },
              ]
            : undefined
        }
      />

      {/* 工具栏 */}
      <div className="mb-4">
        <GraphToolbar />
      </div>

      {/* 主体双栏 */}
      <div className="grid gap-4 min-[900px]:grid-cols-[1fr_360px]">
        {/* 左侧：图谱画布 */}
        <div className="min-w-0 rounded-[14px] border border-line bg-white shadow-sm overflow-hidden">
          <GraphCanvas />
        </div>

        {/* 右侧：详情面板 */}
        <div className="min-w-0">
          <DetailPanel />
        </div>
      </div>
    </div>
  )
}

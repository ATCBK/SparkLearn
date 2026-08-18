'use client'

import { useEffect } from 'react'
import { BookOpen, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { PageHead } from '@/components/proto'
import { cn } from '@/lib/utils/cn'
import { DetailPanel } from '@/features/knowledge-graph/components/DetailPanel'
import { GraphCanvas } from '@/features/knowledge-graph/components/GraphCanvas'
import { GraphToolbar } from '@/features/knowledge-graph/components/GraphToolbar'
import { useGraphStore } from '@/features/knowledge-graph/store/graphStore'

export default function GraphPage() {
  const graphData = useGraphStore((s) => s.graphData)
  const isFullscreen = useGraphStore((s) => s.isFullscreen)
  const loadData = useGraphStore((s) => s.loadData)

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = graphData?.stats

  return (
    <div className={cn(isFullscreen && 'fixed inset-0 z-50 overflow-auto bg-bg p-4')}>
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

      <div className="mb-4">
        <GraphToolbar />
      </div>

      <div className="grid gap-4 min-[900px]:grid-cols-[1fr_360px]">
        <div className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-white shadow-sm">
          <GraphCanvas />
        </div>
        <div className="min-w-0">
          <DetailPanel />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { api, Recommendation } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sparkles, FileText, Presentation, GitBranch, HelpCircle, BookOpen, Code } from 'lucide-react'

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  ppt: <Presentation className="w-5 h-5" />,
  mindmap: <GitBranch className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  reading: <BookOpen className="w-5 h-5" />,
  code: <Code className="w-5 h-5" />,
}

const typeLabels: Record<string, string> = {
  document: '课程文档',
  ppt: 'PPT',
  mindmap: '思维导图',
  quiz: '练习题',
  reading: '拓展阅读',
  code: '代码案例',
}

export default function FeedPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getRecommendations()
      setRecommendations(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-[20px]" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState type="server" onRetry={fetchData} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">资源推送</h1>
        <p className="text-body text-ink-secondary mt-1">AI 为你精选的个性化学习资源</p>
      </div>

      <Card className="p-5 bg-gradient-to-r from-blue/5 to-purple/5 border-none">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple" />
          <p className="text-body text-ink">基于你的学习画像，AI 为你精选以下学习资源。</p>
        </div>
      </Card>

      {recommendations.length === 0 ? (
        <EmptyState type="resources" />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <Card key={rec.id} hoverable className="p-5">
              <div className="w-10 h-10 rounded-[12px] bg-blue-light flex items-center justify-center text-blue mb-4">
                {typeIcons[rec.resource.type]}
              </div>
              <h3 className="text-h3 text-ink mb-1 truncate">{rec.resource.title}</h3>
              <Badge variant="info" size="sm">
                {typeLabels[rec.resource.type] || rec.resource.type}
              </Badge>
              <p className="text-small text-ink-secondary mt-3 leading-relaxed whitespace-normal break-words">
                {rec.reason}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

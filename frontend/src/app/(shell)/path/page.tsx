'use client'

import { useEffect, useState } from 'react'
import { api, LearningPath, PathNode } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { CheckCircle2, Circle, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export default function PathPage() {
  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getLearningPath()
      setPath(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-[280px_1fr] gap-6">
          <Skeleton className="h-96 rounded-[20px]" />
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
      </div>
    )
  }
  if (error) return <ErrorState type="server" onRetry={fetchData} />
  if (!path) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">学习路径</h1>
        <p className="text-body text-ink-secondary mt-1">为你规划的 Python 学习路线</p>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Stages */}
        <Card className="p-5">
          <h3 className="text-small font-semibold text-ink mb-4">学习阶段</h3>
          <div className="space-y-1">
            {path.stages.map((stage, i) => (
              <div
                key={stage.name}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  stage.status === 'current' && 'bg-blue-light',
                )}
              >
                {stage.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                {stage.status === 'current' && <Circle className="w-4 h-4 text-blue fill-blue shrink-0" />}
                {stage.status === 'pending' && <Circle className="w-4 h-4 text-ink-disabled shrink-0" />}
                <span className={cn(
                  'text-small font-medium',
                  stage.status === 'completed' && 'text-ink-secondary',
                  stage.status === 'current' && 'text-blue',
                  stage.status === 'pending' && 'text-ink-disabled',
                )}>
                  {stage.name}
                </span>
                {stage.status === 'current' && (
                  <Badge variant="info" size="sm">当前</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Knowledge Tree */}
        <Card className="p-6">
          <h3 className="text-small font-semibold text-ink mb-4">知识图谱</h3>
          <div className="space-y-2">
            {path.knowledgeTree.map(node => (
              <TreeNode key={node.id} node={node} depth={0} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function TreeNode({ node, depth }: { node: PathNode; depth: number }) {
  const [expanded, setExpanded] = useState(node.status === 'current')
  const hasChildren = node.children && node.children.length > 0

  const statusColor = {
    completed: 'text-success',
    current: 'text-blue',
    pending: 'text-ink-disabled',
  }[node.status]

  const statusBg = {
    completed: 'bg-success/10',
    current: 'bg-blue-light',
    pending: 'bg-bg-hover',
  }[node.status]

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-bg-hover transition-colors',
          node.status === 'current' && 'bg-blue-light/50',
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-ink-tertiary shrink-0" /> : <ChevronRight className="w-4 h-4 text-ink-tertiary shrink-0" />
        ) : (
          <div className="w-4" />
        )}
        <div className={cn('w-2 h-2 rounded-full shrink-0', statusBg)} />
        <span className={cn('text-small', node.status === 'current' ? 'font-semibold text-blue' : node.status === 'completed' ? 'text-ink-secondary' : 'text-ink-disabled')}>
          {node.name}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

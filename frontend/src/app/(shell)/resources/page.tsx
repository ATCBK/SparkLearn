'use client'

import { useEffect, useState } from 'react'
import { api, Resource } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { RESOURCE_TYPES } from '@/lib/utils/constants'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { Search, FileText, Presentation, GitBranch, HelpCircle, BookOpen, Code, Eye } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const typeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-4 h-4" />,
  ppt: <Presentation className="w-4 h-4" />,
  mindmap: <GitBranch className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  reading: <BookOpen className="w-4 h-4" />,
  code: <Code className="w-4 h-4" />,
}

const typeColors: Record<string, string> = {
  document: 'text-blue',
  ppt: 'text-purple',
  mindmap: 'text-teal',
  quiz: 'text-success',
  reading: 'text-warning',
  code: 'text-blue',
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const debouncedSearch = useDebounce(search, 300)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getResources()
      setResources(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = resources.filter(r => {
    const matchesSearch = !debouncedSearch || r.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesFilter = filter === 'all' || r.type === filter
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full rounded-[12px]" />
        <Skeleton className="h-10 w-96 rounded-full" />
        <Skeleton className="h-80 w-full rounded-[20px]" />
      </div>
    )
  }
  if (error) return <ErrorState type="server" onRetry={fetchData} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">资源中心</h1>
        <p className="text-body text-ink-secondary mt-1">搜索和浏览你的学习资源</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-disabled" />
        <input
          type="text"
          placeholder="搜索学习资源..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-12 pl-12 pr-16 rounded-[12px] border border-black/[0.08] bg-bg-card text-body text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-all"
        />
        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-bg-hover text-micro text-ink-tertiary border border-black/[0.06]">⌘K</kbd>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-pill text-small font-medium transition-colors',
            filter === 'all' ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
          )}
        >
          全部
        </button>
        {RESOURCE_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => setFilter(rt.key)}
            className={cn(
              'px-4 py-2 rounded-pill text-small font-medium transition-colors',
              filter === rt.key ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
            )}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Resource Table */}
      {filtered.length === 0 ? (
        <EmptyState type="resources" action={{ label: '去生成', href: '/generate' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <th className="text-left text-caption text-ink-tertiary font-medium px-5 py-3">名称</th>
                <th className="text-left text-caption text-ink-tertiary font-medium px-5 py-3 w-32">类型</th>
                <th className="text-left text-caption text-ink-tertiary font-medium px-5 py-3 w-36">创建时间</th>
                <th className="text-right text-caption text-ink-tertiary font-medium px-5 py-3 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(res => (
                <tr key={res.id} className="border-b border-black/[0.04] last:border-0 hover:bg-bg-hover/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center', typeColors[res.type])}>
                        {typeIcons[res.type]}
                      </div>
                      <span className="text-body font-medium text-ink">{res.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={res.type === 'quiz' ? 'success' : res.type === 'ppt' ? 'purple' : 'info'}>
                      {RESOURCE_TYPES.find(rt => rt.key === res.type)?.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-caption text-ink-tertiary">{res.createdAt}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                      查看
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

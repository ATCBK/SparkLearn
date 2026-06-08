// 图谱工具栏组件
'use client'

import { Search, Maximize2, Minimize2 } from 'lucide-react'
import { useGraphStore, type FilterType } from '../store/graphStore'
import { cn } from '@/lib/utils/cn'

const FILTERS: Array<{ key: FilterType; label: string; color: string }> = [
  { key: 'all', label: '全部', color: 'bg-[#f1f6fc] text-[#52627b]' },
  { key: 'mastered', label: '已掌握', color: 'bg-green-light text-green' },
  { key: 'learning', label: '学习中', color: 'bg-blue-light text-blue' },
  { key: 'not_started', label: '未学习', color: 'bg-orange-light text-orange' },
]

export function GraphToolbar() {
  const filter = useGraphStore((s) => s.filter)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const isFullscreen = useGraphStore((s) => s.isFullscreen)
  const setFilter = useGraphStore((s) => s.setFilter)
  const setSearch = useGraphStore((s) => s.setSearch)
  const toggleFullscreen = useGraphStore((s) => s.toggleFullscreen)

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 状态筛选按钮组 */}
      <div className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white p-1 shadow-sm">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-[8px] px-3 py-1.5 text-small font-bold transition-all',
              filter === f.key ? f.color : 'text-muted hover:text-ink',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索知识点..."
          className="h-9 w-full rounded-[10px] border border-line bg-white pl-9 pr-3 text-small text-ink outline-none placeholder:text-soft focus:border-blue focus:ring-1 focus:ring-blue-light transition-colors"
        />
      </div>

      {/* 全屏按钮 */}
      <button
        onClick={toggleFullscreen}
        className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-line bg-white text-muted hover:border-blue hover:text-blue transition-colors shadow-sm"
        title={isFullscreen ? '退出全屏' : '全屏查看'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  )
}

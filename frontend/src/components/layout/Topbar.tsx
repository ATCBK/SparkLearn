'use client'

import { usePathname } from 'next/navigation'
import { PanelLeftClose } from 'lucide-react'

const PAGE_NAMES: Record<string, { group: string; title: string }> = {
  '/': { group: 'SparkLearn', title: '学习工作台' },
  '/profile': { group: 'SparkLearn', title: '学习画像' },
  '/profile/settings': { group: '底部', title: '个人信息' },
  '/path': { group: 'SparkLearn', title: '个性化路径' },
  '/generate': { group: 'SparkLearn', title: '资源中心' },
  '/knowledge': { group: 'SparkLearn', title: '知识库' },
  '/practice': { group: 'SparkLearn', title: '练习评测' },
  '/practice/mistakes': { group: 'SparkLearn', title: '错题本' },
  '/practice/favorites': { group: 'SparkLearn', title: '收藏题目' },
  '/report': { group: 'SparkLearn', title: '学习报告' },
  '/tutor': { group: '工具', title: '智能辅导' },
  '/agent': { group: 'SparkLearn', title: '学习伙伴' },
}

interface TopbarProps {
  sidebarWidth: number
  sidebarExpanded?: boolean
  onToggleSidebar?: () => void
}

export function Topbar({ sidebarWidth, sidebarExpanded = true, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname()
  const meta = PAGE_NAMES[pathname] || PAGE_NAMES['/']

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-white/95 px-8 transition-[left] duration-300"
      style={{ left: sidebarWidth }}
    >
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
            aria-label={sidebarExpanded ? '折叠侧栏' : '展开侧栏'}
          >
            <PanelLeftClose className={`h-[18px] w-[18px] transition-transform duration-300 ${!sidebarExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
        <div className="text-small font-bold text-muted">
          {meta.group} / <b className="text-ink">{meta.title}</b>
        </div>
      </div>
      <div className="flex items-center gap-3">
      </div>
    </header>
  )
}

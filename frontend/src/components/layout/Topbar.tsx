'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'

const PAGE_NAMES: Record<string, { group: string; title: string }> = {
  '/': { group: '学习中心', title: '学习工作台' },
  '/profile': { group: '学习中心', title: '学习画像' },
  '/profile/settings': { group: '底部', title: '个人信息' },
  '/path': { group: '学习中心', title: '个性化路径' },
  '/generate': { group: '资源与练习', title: '资源中心' },
  '/resources': { group: '资源与练习', title: '资源库' },
  '/knowledge': { group: '个人知识库', title: '我的资料库' },
  '/practice': { group: '资源与练习', title: '练习评测' },
  '/practice/mistakes': { group: '资源与练习', title: '错题本' },
  '/practice/favorites': { group: '资源与练习', title: '收藏题目' },
  '/report': { group: '分析与反馈', title: '学习报表' },
  '/loop': { group: '分析与反馈', title: '复习计划' },
  '/tutor': { group: '工具', title: '智能辅导' },
  '/video': { group: '工具', title: '视频中心' },
}

export function Topbar({ sidebarWidth }: { sidebarWidth: number }) {
  const pathname = usePathname()
  const meta = PAGE_NAMES[pathname] || PAGE_NAMES['/']

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-white/95 px-8"
      style={{ left: sidebarWidth }}
    >
      <div className="text-small font-bold text-muted">
        {meta.group} / <b className="text-ink">{meta.title}</b>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-line bg-[#f9fafb] px-3 text-muted lg:flex">
          <Search className="h-4 w-4" />
          <span className="text-small">搜索资源、知识点、错题</span>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-muted" aria-label="通知">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-small font-extrabold text-text">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-blue text-micro text-white">张</span>
          <span className="hidden sm:inline">张同学</span>
        </div>
      </div>
    </header>
  )
}

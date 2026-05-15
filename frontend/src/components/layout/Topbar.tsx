'use client'

import { usePathname } from 'next/navigation'

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
      </div>
    </header>
  )
}

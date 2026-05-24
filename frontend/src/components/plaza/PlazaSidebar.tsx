'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, FolderTree, Heart, History, Home, MessageCircle, MessageSquare } from 'lucide-react'

const BOARDS = [
  { key: 'resource_share', label: '资料共享', count: 24, href: '/plaza/resource-share' },
  { key: 'qa', label: '学习答疑', count: 38, href: '/plaza/qa' },
  { key: 'team_study', label: '组队共学', count: 16, href: '/plaza/team-study' },
  { key: 'experience_share', label: '经验共享', count: 29, href: '/plaza/experience-share' },
]

export function PlazaSidebar() {
  const pathname = usePathname()
  const isHome = pathname === '/plaza'

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[260px] flex-col border-r border-line bg-[#f5f7fb] pt-14">
      <div className="border-b border-line px-2 py-3">
        <Link href="/plaza" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold ${isHome ? 'bg-white text-ink' : 'text-ink-secondary hover:bg-white'}`}>
          <Home className="h-4 w-4" />
          <span>首页</span>
        </Link>

        <div className="mt-1 flex items-center gap-3 px-3 py-2 text-sm font-bold text-ink">
          <FolderTree className="h-4 w-4" />
          <span>分类版块</span>
        </div>

        <div className="space-y-1 pl-6">
          {BOARDS.map((board) => {
            const active = pathname === board.href
            return (
            <Link
              key={board.key}
              href={board.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white ${
                active ? 'bg-white font-bold text-ink' : 'text-ink-secondary'
              }`}
            >
              <span>{board.label}</span>
              <span className="text-xs text-muted">{board.count}</span>
            </Link>
          )})}
        </div>
      </div>

      <div className="border-b border-line px-2 py-3">
        <div className="mt-1 flex items-center gap-3 px-3 py-2 text-sm font-bold text-ink">
          <MessageSquare className="h-4 w-4" />
          <span>我的互动</span>
        </div>
        <div className="space-y-1 pl-6">
          <Link href="/plaza/my-likes" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white ${pathname === '/plaza/my-likes' ? 'bg-white font-bold text-ink' : 'text-ink-secondary'}`}>
            <Heart className="h-3.5 w-3.5" />
            <span>我点赞</span>
          </Link>
          <Link href="/plaza/history" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white ${pathname === '/plaza/history' ? 'bg-white font-bold text-ink' : 'text-ink-secondary'}`}>
            <History className="h-3.5 w-3.5" />
            <span>历史记录</span>
          </Link>
          <Link href="/plaza/my-comments" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white ${pathname === '/plaza/my-comments' ? 'bg-white font-bold text-ink' : 'text-ink-secondary'}`}>
            <MessageCircle className="h-3.5 w-3.5" />
            <span>我的评论</span>
          </Link>
        </div>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue" />
            <span className="text-sm font-extrabold text-ink">SparkLearn 学习广场</span>
          </div>
          <p className="mt-2 text-xs text-muted">关于学习交流、建议反馈、功能体验等。</p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <MessageCircle className="h-4 w-4" />
          <span>由 SparkLearn 提供论坛服务</span>
        </div>
      </div>
    </aside>
  )
}

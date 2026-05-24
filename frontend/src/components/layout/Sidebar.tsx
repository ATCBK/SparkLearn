'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, BookOpen, Bot, CheckSquare, Database, Home, LogOut, Map, MessageSquare, User } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  group: string
  newTab?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: '学习工作台', href: '/', icon: <Home className="h-5 w-5" />, group: '学习中心' },
  { label: '学习画像', href: '/profile', icon: <User className="h-5 w-5" />, group: '学习中心' },
  { label: '个性化路径', href: '/path', icon: <Map className="h-5 w-5" />, group: '学习中心' },
  { label: '知识库', href: '/knowledge', icon: <Database className="h-5 w-5" />, group: '学习中心' },
  { label: '资源中心', href: '/generate', icon: <BookOpen className="h-5 w-5" />, group: '资源与练习' },
  { label: '练习评测', href: '/practice', icon: <CheckSquare className="h-5 w-5" />, group: '资源与练习' },
  { label: '学习伙伴', href: '/agent', icon: <Bot className="h-5 w-5" />, group: '资源与练习' },
  { label: '学习报告', href: '/report', icon: <BarChart3 className="h-5 w-5" />, group: '分析与反馈' },
]

interface SidebarProps {
  state: 'expanded' | 'icons' | 'collapsed'
  onStateChange: (state: 'expanded' | 'icons' | 'collapsed') => void
}

export function Sidebar({ state }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isExpanded = state === 'expanded'
  const isIcons = state === 'icons'

  const groupedItems = NAV_ITEMS.reduce(
    (acc, item) => {
      const group = acc.find((g) => g.name === item.group)
      if (group) {
        group.items.push(item)
      } else {
        acc.push({ name: item.group, items: [item] })
      }
      return acc
    },
    [] as Array<{ name: string; items: NavItem[] }>,
  )

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sparklearn_user')
      localStorage.removeItem('sparklearn_token')
      sessionStorage.clear()
    }
    router.push('/auth')
  }

  return (
    <div
      className={`fixed left-0 top-0 z-20 h-screen overflow-y-auto border-r border-[#E5EAF2] bg-white transition-all duration-300 ${
        isExpanded ? 'w-[220px]' : isIcons ? 'w-[74px]' : 'w-0 overflow-hidden'
      }`}
    >
      <div className="border-b border-[#E5EAF2] p-4">
        <div className="flex items-center gap-3">
          <img src="/sparklearn-logo-official.png" alt="SparkLearn Logo" className="h-10 w-10 shrink-0 object-contain" />
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#111827]">学而思 SparkLearn</div>
              <div className="truncate text-xs text-[#6B7280]">个性化学习闭环</div>
            </div>
          )}
        </div>
      </div>

      <nav className="space-y-6 px-3 py-6">
        {groupedItems.map((group) => (
          <div key={group.name}>
            {isExpanded && <div className="px-3 text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF]">{group.name}</div>}
            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    title={isIcons ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                      isIcons ? 'justify-center' : ''
                    } ${isActive ? 'bg-[#EEF5FF] text-[#2563EB]' : 'text-[#52627B] hover:bg-[#F3F4F6]'}`}
                  >
                    {item.icon}
                    {isExpanded && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="absolute bottom-4 left-3 right-3 space-y-3">
        {isExpanded ? (
          <>
            <Link
              href="/plaza"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-[12px] border border-line bg-white p-3 transition-colors hover:bg-bg-hover"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF5FF] text-[#2563EB]">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-bold text-ink">学习广场</div>
                <div className="truncate text-micro text-muted">点击进入独立页面</div>
              </div>
            </Link>
            <Link href="/profile/settings" className="flex items-center gap-3 rounded-[12px] border border-line bg-bg-hover p-3 transition-colors hover:bg-bg-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue text-small font-bold text-white">李</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-bold text-ink">李明</div>
                <div className="truncate text-micro text-muted">个人设置</div>
              </div>
            </Link>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#52627B] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]">
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </>
        ) : isIcons ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/plaza"
              target="_blank"
              rel="noopener noreferrer"
              title="学习广场"
              className="grid h-9 w-9 place-items-center rounded-lg text-[#2563EB] transition-colors hover:bg-[#EEF5FF]"
            >
              <MessageSquare className="h-4 w-4" />
            </Link>
            <Link href="/profile/settings" title="个人设置" className="grid h-9 w-9 place-items-center rounded-full bg-blue text-small font-bold text-white">
              李
            </Link>
            <button
              onClick={handleLogout}
              title="退出登录"
              className="grid h-9 w-9 place-items-center rounded-lg text-[#52627B] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

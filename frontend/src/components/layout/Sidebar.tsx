'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ThemeSwitch } from '@/components/ui/ThemeSwitch'
import {
  Home,
  User,
  Map,
  BookOpen,
  CheckSquare,
  BarChart3,
  Database,
  Zap,
  LogOut,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  group: string
}

const NAV_ITEMS: NavItem[] = [
  // 学习中心
  { label: '学习工作台', href: '/', icon: <Home className="h-5 w-5" />, group: '学习中心' },
  { label: '学习画像', href: '/profile', icon: <User className="h-5 w-5" />, group: '学习中心' },
  { label: '个性化路径', href: '/path', icon: <Map className="h-5 w-5" />, group: '学习中心' },
  { label: '知识库', href: '/knowledge', icon: <Database className="h-5 w-5" />, group: '学习中心' },

  // 资源与练习
  { label: '资源中心', href: '/generate', icon: <BookOpen className="h-5 w-5" />, group: '资源与练习' },
  { label: '练习评测', href: '/practice', icon: <CheckSquare className="h-5 w-5" />, group: '资源与练习' },

  // 分析与反馈
  { label: '学习报告', href: '/report', icon: <BarChart3 className="h-5 w-5" />, group: '分析与反馈' },
]

interface SidebarProps {
  state: 'expanded' | 'icons' | 'collapsed'
  onStateChange: (state: 'expanded' | 'icons' | 'collapsed') => void
}

export function Sidebar({ state, onStateChange }: SidebarProps) {
  const pathname = usePathname()

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
    [] as Array<{ name: string; items: NavItem[] }>
  )

  const sidebarWidth = state === 'expanded' ? 220 : state === 'icons' ? 74 : 0

  return (
    <div className="fixed left-0 top-0 z-20 h-screen w-[220px] border-r border-[#E5EAF2] bg-white overflow-y-auto">
      {/* Logo 区域 */}
      <div className="border-b border-[#E5EAF2] p-4">
        <div className="flex items-center gap-3">
          <img src="/sparklearn-logo-official.png" alt="SparkLearn Logo" className="h-10 w-10 object-contain" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#111827]">学而思 SparkLearn</div>
            <div className="text-xs text-[#6B7280] truncate">个性化学习闭环</div>
          </div>
        </div>
      </div>

      {/* 导航分组 */}
      <nav className="space-y-6 px-3 py-6">
        {groupedItems.map((group) => (
          <div key={group.name}>
            <div className="px-3 text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF]">
              {group.name}
            </div>
            <div className="mt-3 space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-[#EEF5FF] text-[#2563EB]'
                        : 'text-[#52627B] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 底部用户设置中心 */}
      <div className="absolute bottom-4 left-3 right-3 space-y-3">
        <ThemeSwitch />
        <Link
          href="/profile/settings"
          className="flex items-center gap-3 rounded-[12px] border border-line bg-bg-hover p-3 hover:bg-bg-card transition-colors"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue text-small font-bold text-white shrink-0">李</span>
          <div className="flex-1 min-w-0">
            <div className="text-small font-bold text-ink truncate">李明</div>
            <div className="text-micro text-muted truncate">个人设置</div>
          </div>
          <LogOut className="h-4 w-4 text-muted shrink-0" />
        </Link>
      </div>
    </div>
  )
}

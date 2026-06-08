'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, BookOpen, Bot, CheckSquare, Database, Globe, Home, LogOut, Map, MessageSquare, Network, Settings2, User, Zap } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  group: string
  newTab?: boolean
}

type SparklearnDesktopBridge = {
  openStudyBuddyConfig?: () => void
}

declare global {
  interface Window {
    sparklearnDesktop?: SparklearnDesktopBridge
  }
}

const NAV_ITEMS: NavItem[] = [
  { label: '学习工作台', href: '/', icon: <Home className="h-5 w-5" />, group: '学习中心' },
  { label: '学习画像', href: '/profile', icon: <User className="h-5 w-5" />, group: '学习中心' },
  { label: '个性化路径', href: '/path', icon: <Map className="h-5 w-5" />, group: '学习中心' },
  { label: '知识图谱', href: '/graph', icon: <Network className="h-5 w-5" />, group: '学习中心' },
  { label: '知识库', href: '/knowledge', icon: <Database className="h-5 w-5" />, group: '学习中心' },
  { label: '资源中心', href: '/generate', icon: <BookOpen className="h-5 w-5" />, group: '资源与练习' },
  { label: '练习评测', href: '/practice', icon: <CheckSquare className="h-5 w-5" />, group: '资源与练习' },
  { label: '学习伙伴', href: '/agent', icon: <Bot className="h-5 w-5" />, group: '资源与练习' },
  { label: '学习发现', href: '/info-stream', icon: <Globe className="h-5 w-5" />, group: '资源与练习' },
  { label: '学习报告', href: '/report', icon: <BarChart3 className="h-5 w-5" />, group: '分析与反馈' },
]

interface SidebarProps {
  state: 'expanded' | 'icons' | 'collapsed'
  onStateChange: (state: 'expanded' | 'icons' | 'collapsed') => void
}

export function Sidebar({ state }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [desktopReady] = useState(() => (
    typeof window !== 'undefined' && Boolean(window.sparklearnDesktop?.openStudyBuddyConfig)
  ))
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

  const openStudyBuddyConfig = async () => {
    try {
      await window.sparklearnDesktop?.openStudyBuddyConfig?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(`StudyBuddy 配置窗口暂时无法打开。\n\n${message}\n\n请先重启桌面端，再重试。`)
    }
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
          <div
            className={`min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-out ${
              isExpanded ? 'max-w-[180px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-1'
            }`}
          >
            <div className="text-sm font-bold text-[#111827] whitespace-nowrap">学而思 SparkLearn</div>
            <div className="truncate text-xs text-[#6B7280]">个性化学习闭环</div>
          </div>
        </div>
      </div>

      <nav className="space-y-6 px-3 py-6">
        {groupedItems.map((group) => (
          <div key={group.name}>
            <div
              className={`px-3 text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF] overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                isExpanded ? 'max-h-6 opacity-100 mb-0' : 'max-h-0 opacity-0'
              }`}
            >
              {group.name}
            </div>
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
                    <span
                      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                        isExpanded ? 'max-w-[140px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-1'
                      }`}
                    >
                      {item.label}
                    </span>
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
            {desktopReady && (
              <div className="relative">
                <div className="absolute -right-1 -top-2 z-10 rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                  支持多渠道
                </div>
                <button
                  type="button"
                  onClick={openStudyBuddyConfig}
                  className="flex w-full items-center gap-3 rounded-[12px] border border-[#BFDBFE] bg-[#F8FBFF] p-3 text-left transition-colors hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DBEAFE] text-[#2563EB]">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-small font-bold text-[#1E3A8A]">StudyBuddy 配置</div>
                    <div className="truncate text-micro text-[#64748B]">配置 StudyBuddy 渠道与本地模型</div>
                  </div>
                  <Settings2 className="h-4 w-4 shrink-0 text-[#2563EB]" />
                </button>
              </div>
            )}
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
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#52627B] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]">
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </>
        ) : isIcons ? (
          <div className="flex flex-col items-center gap-2">
            {desktopReady && (
              <button
                type="button"
                onClick={openStudyBuddyConfig}
                title="StudyBuddy 配置：支持多渠道"
                className="relative grid h-9 w-9 place-items-center rounded-lg text-[#2563EB] transition-colors hover:bg-[#EEF5FF]"
              >
                <Zap className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#2563EB]" />
              </button>
            )}
            <Link
              href="/plaza"
              target="_blank"
              rel="noopener noreferrer"
              title="学习广场"
              className="grid h-9 w-9 place-items-center rounded-lg text-[#2563EB] transition-colors hover:bg-[#EEF5FF]"
            >
              <MessageSquare className="h-4 w-4" />
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

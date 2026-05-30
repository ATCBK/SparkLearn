'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, BellRing, Bot, GraduationCap, LayoutDashboard, LogOut, MessageSquare, Monitor, Users } from 'lucide-react'

const NAV = [
  { label: '工作台', href: '/teacher/dashboard', icon: LayoutDashboard },
  { label: '学生管理', href: '/teacher/students', icon: Users },
  { label: '干预中心', href: '/teacher/interventions', icon: AlertTriangle },
  { label: '通知分发', href: '/teacher/broadcast', icon: BellRing },
  { label: 'AI 助手', href: '/teacher/ai', icon: Bot },
  { label: '学习报告', href: '/teacher/reports', icon: BarChart3 },
]

export default function TeacherShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setHasToken(!!window.localStorage.getItem('teacher_token'))
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) return
    if (!hasToken && pathname !== '/teacher/login') {
      router.replace('/teacher/login')
    }
  }, [hasToken, isReady, pathname, router])

  if (pathname === '/teacher/login') return <>{children}</>
  if (!isReady) return null
  if (!hasToken) return null

  const handleLogout = () => {
    localStorage.removeItem('teacher_token')
    setHasToken(false)
    router.push('/teacher/login')
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[236px] flex-col border-r border-[#e8edf5] bg-white min-[900px]:flex">
        <div className="flex items-center gap-3 border-b border-[#edf2f8] px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">SparkLearn</div>
            <div className="text-xs text-ink-secondary">教师数据中台</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                  active ? 'bg-[#EEF5FF] text-[#2563EB]' : 'text-[#52627B] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-[#edf2f8] px-3 py-3">
          <Link
            href="/plaza"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627B] transition-colors hover:bg-[#F3F4F6]"
          >
            <MessageSquare className="h-5 w-5 shrink-0" />
            学习广场
          </Link>
          <Link
            href="/screen/index.html"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627B] transition-colors hover:bg-[#F3F4F6]"
          >
            <Monitor className="h-5 w-5 shrink-0" />
            打开关联大屏
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627B] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            退出登录
          </button>
        </div>
      </aside>

      <main
        className="min-h-screen w-full min-w-0 flex-1 min-[900px]:ml-[236px]"
        style={{
          backgroundImage: 'url(/gongzuotai-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
        }}
      >
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-[#e8edf5] bg-white/96 px-4 py-3 backdrop-blur min-[900px]:h-14 min-[900px]:px-8 min-[900px]:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-extrabold text-[#2563eb]">教师工作台</span>
            <span className="truncate text-xs font-semibold text-[#64748b]">{NAV.find((n) => pathname.startsWith(n.href))?.label ?? '数据总览'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#eaf2ff] text-xs font-bold text-[#2563eb]">师</div>
            <span className="hidden text-sm font-semibold text-ink min-[480px]:inline">教师账号</span>
          </div>
        </header>
        <div className="min-h-[calc(100vh-56px)] px-4 py-5 min-[900px]:px-8 min-[900px]:py-7">
          <div className="mx-auto w-full max-w-[1360px] min-w-0">{children}</div>
        </div>
      </main>
    </div>
  )
}

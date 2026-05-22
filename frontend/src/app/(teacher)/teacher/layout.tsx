'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3, BookOpen, Bot, GraduationCap,
  LayoutDashboard, LogOut, Monitor, Users, AlertTriangle,
} from 'lucide-react'

const NAV = [
  { label: '工作台',   href: '/teacher/dashboard',      icon: LayoutDashboard },
  { label: '学生管理', href: '/teacher/students',        icon: Users },
  { label: '干预中心', href: '/teacher/interventions',   icon: AlertTriangle },
  { label: 'AI 助手',  href: '/teacher/ai',              icon: Bot },
  { label: '学习报告', href: '/teacher/reports',         icon: BarChart3 },
]

export default function TeacherShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // 简单演示鉴权：检查 teacher_token
    const token = localStorage.getItem('teacher_token')
    if (!token && pathname !== '/teacher/login') {
      router.replace('/teacher/login')
    } else {
      setReady(true)
    }
  }, [pathname, router])

  // 登录页不需要 shell
  if (pathname === '/teacher/login') return <>{children}</>
  if (!ready) return null

  const handleLogout = () => {
    localStorage.removeItem('teacher_token')
    router.push('/teacher/login')
  }

  return (
    <div className="flex min-h-screen bg-[#f6f8fb]">
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-[220px] flex-col border-r border-[#e5e7eb] bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-[#e5e7eb] px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#111827]">教师工作台</div>
            <div className="text-xs text-[#6b7280]">SparkLearn</div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? 'bg-[#eff6ff] text-[#2563eb]'
                    : 'text-[#52627b] hover:bg-[#f3f4f6]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 底部 */}
        <div className="border-t border-[#e5e7eb] px-3 py-3 space-y-1">
          <Link
            href="/screen/index.html"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627b] hover:bg-[#f3f4f6] transition-colors"
          >
            <Monitor className="h-4 w-4 shrink-0" />
            打开大屏
          </Link>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627b] hover:bg-[#f3f4f6] transition-colors"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            学生端
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627b] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="ml-[220px] flex-1 min-h-screen">
        {/* 顶栏 */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#e5e7eb] bg-white/95 backdrop-blur px-8">
          <div className="text-sm font-bold text-[#111827]">
            {NAV.find(n => pathname.startsWith(n.href))?.label ?? '教师工作台'}
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#2563eb] text-xs font-bold text-white">
              师
            </div>
            <span className="text-sm font-bold text-[#111827]">教师账号</span>
          </div>
        </header>

        {/* 页面内容 */}
        <div
          className="min-h-[calc(100vh-56px)] px-8 py-7"
          style={{
            backgroundImage: 'url(/gongzuotai-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundAttachment: 'fixed',
          }}
        >
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </div>
      </main>
    </div>
  )
}

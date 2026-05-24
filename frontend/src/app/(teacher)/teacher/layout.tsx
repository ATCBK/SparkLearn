'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AlertTriangle, BarChart3, Bot, GraduationCap, LayoutDashboard, LogOut, Monitor, Users } from 'lucide-react'

const NAV = [
  { label: '工作台', href: '/teacher/dashboard', icon: LayoutDashboard },
  { label: '学生管理', href: '/teacher/students', icon: Users },
  { label: '干预中心', href: '/teacher/interventions', icon: AlertTriangle },
  { label: 'AI 助手', href: '/teacher/ai', icon: Bot },
  { label: '学习报告', href: '/teacher/reports', icon: BarChart3 },
]

export default function TeacherShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hasToken = typeof window !== 'undefined' && !!window.localStorage.getItem('teacher_token')

  useEffect(() => {
    if (!hasToken && pathname !== '/teacher/login') {
      router.replace('/teacher/login')
    }
  }, [hasToken, pathname, router])

  if (pathname === '/teacher/login') return <>{children}</>
  if (!hasToken) return null

  const handleLogout = () => {
    localStorage.removeItem('teacher_token')
    router.push('/teacher/login')
  }

  return (
    <div className="flex min-h-screen bg-[#f4f7fb]">
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-[236px] flex-col border-r border-[#dfe6ef] bg-white">
        <div className="flex items-center gap-3 border-b border-[#e5ebf3] px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f4c81] text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0f172a]">学而思 SparkLearn</div>
            <div className="text-xs text-[#64748b]">教师数据中台</div>
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-[#e8f1fb] text-[#0f4c81]' : 'text-[#475569] hover:bg-[#f1f5f9]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-1 border-t border-[#e5ebf3] px-3 py-3">
          <Link
            href="/screen/index.html"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#475569] transition-colors hover:bg-[#f1f5f9]"
          >
            <Monitor className="h-4 w-4 shrink-0" />
            打开关联大屏
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#475569] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="ml-[236px] min-h-screen flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#dfe6ef] bg-white/95 px-8 backdrop-blur">
          <div className="text-sm font-bold text-[#0f172a]">{NAV.find((n) => pathname.startsWith(n.href))?.label ?? '教师工作台'}</div>
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0f4c81] text-xs font-bold text-white">师</div>
            <span className="text-sm font-semibold text-[#0f172a]">教师账号</span>
          </div>
        </header>
        <div
          className="min-h-[calc(100vh-56px)] px-8 py-7"
          style={{
            backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(15,76,129,0.08), transparent 50%), radial-gradient(circle at 0% 100%, rgba(16,185,129,0.08), transparent 40%)',
          }}
        >
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </div>
      </main>
    </div>
  )
}


'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useReducer } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MonitorCog,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react'
import { api } from '@/lib/api'
import { getAdminToken, removeAdminToken } from '@/lib/auth'

const NAV = [
  { label: '平台总览', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: '用户与权限', href: '/admin/users', icon: UsersRound },
  { label: '帖子审核', href: '/admin/forum', icon: FileCheck2 },
  { label: '审计日志', href: '/admin/audit', icon: ClipboardList },
  { label: '系统设置', href: '/admin/settings', icon: SlidersHorizontal },
]

type AdminAuthState = {
  mounted: boolean
  hasToken: boolean
  authResolved: boolean
  adminName: string
}

type AdminAuthAction =
  | { type: 'mounted' }
  | { type: 'sync-auth'; hasToken: boolean; adminName?: string }
  | { type: 'logout' }

function adminAuthReducer(state: AdminAuthState, action: AdminAuthAction): AdminAuthState {
  switch (action.type) {
    case 'mounted':
      return state.mounted ? state : { ...state, mounted: true }
    case 'sync-auth':
      return { ...state, hasToken: action.hasToken, authResolved: true, adminName: action.adminName || '' }
    case 'logout':
      return { mounted: state.mounted, hasToken: false, authResolved: true, adminName: '' }
    default:
      return state
  }
}

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authState, dispatch] = useReducer(adminAuthReducer, {
    mounted: false,
    hasToken: false,
    authResolved: false,
    adminName: '',
  })

  useEffect(() => {
    dispatch({ type: 'mounted' })
  }, [])

  useEffect(() => {
    if (!authState.mounted) return

    const token = getAdminToken()
    if (!token) {
      dispatch({ type: 'sync-auth', hasToken: false })
      return
    }
    dispatch({ type: 'sync-auth', hasToken: true })
    let cancelled = false
    api.getAdminMe()
      .then((admin) => {
        if (!cancelled) dispatch({ type: 'sync-auth', hasToken: true, adminName: admin.name })
      })
      .catch(() => {
        removeAdminToken()
        if (!cancelled) dispatch({ type: 'sync-auth', hasToken: false })
      })
    return () => {
      cancelled = true
    }
  }, [authState.mounted, pathname])

  useEffect(() => {
    if (!authState.mounted || !authState.authResolved) return

    if (!authState.hasToken && pathname !== '/admin/login') {
      const latestToken = getAdminToken()
      if (latestToken) {
        dispatch({ type: 'sync-auth', hasToken: true })
        return
      }
      router.replace('/admin/login')
    }
  }, [authState.authResolved, authState.hasToken, authState.mounted, pathname, router])

  if (!authState.mounted) return null
  if (pathname === '/admin/login') return <>{children}</>
  if (!authState.hasToken) return null

  const handleLogout = () => {
    removeAdminToken()
    dispatch({ type: 'logout' })
    router.push('/admin/login')
  }

  const current = NAV.find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[244px] flex-col border-r border-[#e8edf5] bg-white min-[900px]:flex">
        <div className="flex items-center gap-3 border-b border-[#edf2f8] px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-ink">SparkLearn</div>
            <div className="text-xs text-ink-secondary">平台管理端</div>
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
            href="/teacher/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627B] transition-colors hover:bg-[#F3F4F6]"
          >
            <GraduationCap className="h-5 w-5 shrink-0" />
            教师端
          </Link>
          <Link
            href="/screen/index.html"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#52627B] transition-colors hover:bg-[#F3F4F6]"
          >
            <BarChart3 className="h-5 w-5 shrink-0" />
            数据大屏
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
        className="min-h-screen w-full min-w-0 flex-1 min-[900px]:ml-[244px]"
        style={{
          backgroundImage: 'url(/gongzuotai-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
        }}
      >
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-[#e8edf5] bg-white/96 px-4 py-3 backdrop-blur min-[900px]:h-14 min-[900px]:px-8 min-[900px]:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-extrabold text-[#2563eb]">平台管理端</span>
            <span className="text-xs font-semibold text-[#64748b]">{current?.label ?? '管理工作台'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden h-8 items-center gap-2 rounded-lg bg-[#f8fafc] px-3 text-xs font-bold text-[#52627b] ring-1 ring-[#e5eaf2] min-[520px]:inline-flex">
              <Activity className="h-4 w-4 text-[#16a34a]" />
              服务正常
            </span>
            <Link href="/admin/audit" title="通知" className="grid h-8 w-8 place-items-center rounded-lg text-[#52627b] hover:bg-[#f3f4f6]">
              <Bell className="h-4 w-4" />
            </Link>
            <Link href="/admin/settings" title="运维配置" className="grid h-8 w-8 place-items-center rounded-lg text-[#52627b] hover:bg-[#f3f4f6]">
              <MonitorCog className="h-4 w-4" />
            </Link>
            <div className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-[#eaf2ff] text-xs font-bold text-[#2563eb]">A</div>
            <span className="hidden text-sm font-semibold text-ink min-[520px]:inline">{authState.adminName || '管理员'}</span>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="退出登录"
              title="退出登录"
              className="grid h-8 w-8 place-items-center rounded-lg text-[#52627b] hover:bg-[#fef2f2] hover:text-[#dc2626] min-[900px]:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <nav className="sticky top-[57px] z-10 flex gap-2 overflow-x-auto border-b border-[#e8edf5] bg-white/96 px-4 py-2 backdrop-blur min-[900px]:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors ${
                  active ? 'bg-[#EEF5FF] text-[#2563EB]' : 'text-[#52627B] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="min-h-[calc(100vh-56px)] px-4 py-5 min-[900px]:px-8 min-[900px]:py-7">
          <div className="mx-auto w-full max-w-[1360px] min-w-0">{children}</div>
        </div>
      </main>
    </div>
  )
}

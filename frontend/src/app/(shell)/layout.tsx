'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AIAssistant } from '@/components/layout/AIAssistant'
import { MOBILE_TABS, PAGE_META } from '@/components/layout/navigation'
import { GenerationTaskProvider } from '@/components/providers/GenerationTaskProvider'
import { useBreakpoint } from '@/lib/hooks/useMediaQuery'

function MobileTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const meta = PAGE_META[pathname] || PAGE_META['/']
  const isMainTab = meta.isMainTab

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sparklearn_user')
      localStorage.removeItem('sparklearn_token')
      sessionStorage.clear()
    }
    router.push('/auth')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-line bg-white/95 backdrop-blur px-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        {!isMainTab && (
          <button
            onClick={() => router.back()}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="返回上一页"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <div className="text-[11px] text-[#6B7280] truncate">{meta.group}</div>
          <div className="text-sm font-bold text-[#111827] truncate">{meta.title}</div>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#fef2f2] hover:text-[#dc2626]"
        aria-label="退出登录"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  )
}

function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[70] border-t border-line bg-white/95 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+4px)]">
      <div className="grid h-16 grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                active ? 'text-[#2563EB]' : 'text-[#6B7280]'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isMobile } = useBreakpoint()
  const [sidebarState, setSidebarState] = useState<'expanded' | 'icons' | 'collapsed'>('expanded')
  const sidebarWidth = sidebarState === 'expanded' ? 220 : sidebarState === 'icons' ? 74 : 0

  if (isMobile) {
    return (
      <GenerationTaskProvider>
        <div className="min-h-screen bg-bg">
          <MobileTopbar />
          <main
            className="min-h-screen pt-14 pb-28"
            style={{
              backgroundImage: 'url(/gongzuotai-bg.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
            }}
          >
            <div className="mx-auto max-w-[560px] px-3 py-4">{children}</div>
          </main>
          <BottomTabBar />
        </div>
      </GenerationTaskProvider>
    )
  }

  return (
    <GenerationTaskProvider>
      <div className="min-h-screen bg-bg">
        <Sidebar state={sidebarState} onStateChange={setSidebarState} />
        <Topbar
          sidebarWidth={sidebarWidth}
          sidebarExpanded={sidebarState === 'expanded'}
          onToggleSidebar={() => setSidebarState(sidebarState === 'expanded' ? 'icons' : 'expanded')}
        />
        <main
          className="min-h-screen pt-14 transition-[margin-left] duration-300 ease-out"
          style={{
            marginLeft: sidebarWidth,
            backgroundImage: 'url(/gongzuotai-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundAttachment: 'fixed',
          }}
        >
          <div className="mx-auto max-w-[1360px] px-8 py-7 max-[760px]:px-4">{children}</div>
        </main>
        <AIAssistant />
        {sidebarState === 'collapsed' && (
          <button
            onClick={() => setSidebarState('expanded')}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-bg-card/80 backdrop-blur-sm rounded-r-lg shadow-sm flex items-center justify-center hover:bg-bg-hover transition-colors"
            aria-label="展开侧栏"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </GenerationTaskProvider>
  )
}

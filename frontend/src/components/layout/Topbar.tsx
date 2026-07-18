'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LogOut, PanelLeftClose, Settings } from 'lucide-react'
import { logout } from '@/lib/auth'
import { PAGE_META } from '@/components/layout/navigation'
import { useCurrentUserDisplay } from '@/hooks/useCurrentUserDisplay'

interface TopbarProps {
  sidebarWidth: number
  sidebarExpanded?: boolean
  onToggleSidebar?: () => void
}

export function Topbar({ sidebarWidth, sidebarExpanded = true, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname()
  const meta = PAGE_META[pathname] || PAGE_META['/']
  const [userPanelOpen, setUserPanelOpen] = useState(false)
  const { nameChar, avatarUrl } = useCurrentUserDisplay()

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-white/95 px-8 transition-[left] duration-300"
      style={{ left: sidebarWidth }}
    >
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
            aria-label={sidebarExpanded ? '折叠侧栏' : '展开侧栏'}
          >
            <PanelLeftClose className={`h-[18px] w-[18px] transition-transform duration-300 ${!sidebarExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
        <div className="text-small font-bold text-muted">
          {meta.group} / <b className="text-ink">{meta.title}</b>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserPanelOpen((value) => !value)}
            className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
            title="用户面板"
            aria-label="打开用户面板"
            aria-expanded={userPanelOpen}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="用户头像" className="h-9 w-9 rounded-full object-cover ring-1 ring-[#e5e7eb]" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-blue text-sm font-bold text-white">{nameChar}</span>
            )}
          </button>

          {userPanelOpen ? (
            <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white py-2 shadow-lg shadow-black/10">
              <Link
                href="/profile/settings"
                onClick={() => setUserPanelOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#475569] transition-colors hover:bg-[#f8fafc] hover:text-[#2563eb]"
              >
                <Settings className="h-4 w-4" />
                个人设置
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[#475569] transition-colors hover:bg-[#fef2f2] hover:text-[#dc2626]"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

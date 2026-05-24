'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PanelLeftClose } from 'lucide-react'
import { PAGE_META } from '@/components/layout/navigation'

interface TopbarProps {
  sidebarWidth: number
  sidebarExpanded?: boolean
  onToggleSidebar?: () => void
}

export function Topbar({ sidebarWidth, sidebarExpanded = true, onToggleSidebar }: TopbarProps) {
  const pathname = usePathname()
  const meta = PAGE_META[pathname] || PAGE_META['/']
  const [nameChar, setNameChar] = useState('李')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('sparklearn_user')
      if (!raw) return
      const user = JSON.parse(raw) as { name?: string; avatar?: string }
      const c = (user?.name || '').trim()
      if (c) setNameChar(c[0])
      if (user?.avatar) setAvatarUrl(user.avatar)
    } catch {
      // keep defaults
    }
  }, [])

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
        <Link
          href="/profile/settings"
          className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
          title="个人设置"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="用户头像" className="h-9 w-9 rounded-full object-cover ring-1 ring-[#e5e7eb]" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-blue text-sm font-bold text-white">{nameChar}</span>
          )}
        </Link>
      </div>
    </header>
  )
}

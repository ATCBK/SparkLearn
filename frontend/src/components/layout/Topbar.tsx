'use client'

import { usePathname } from 'next/navigation'
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
      <div className="flex items-center gap-3" />
    </header>
  )
}

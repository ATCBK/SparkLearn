'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarState, setSidebarState] = useState<'expanded' | 'icons' | 'collapsed'>('expanded')
  const pathname = usePathname()

  const marginLeft = sidebarState === 'expanded' ? 260 : sidebarState === 'icons' ? 64 : 0
  const isTutor = pathname === '/tutor'

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar state={sidebarState} onStateChange={setSidebarState} />
      <main
        className="min-h-screen transition-[margin-left] duration-300 ease-out"
        style={{ marginLeft }}
      >
        <div className={isTutor ? 'max-w-none px-0 py-0' : 'max-w-[1200px] mx-auto px-[52px] py-10'}>
          {children}
        </div>
      </main>
      {/* Collapsed arrow trigger */}
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
  )
}

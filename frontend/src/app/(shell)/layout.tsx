'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { AIAssistant } from '@/components/layout/AIAssistant'

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarState, setSidebarState] = useState<'expanded' | 'icons' | 'collapsed'>('expanded')

  const sidebarWidth = sidebarState === 'expanded' ? 220 : sidebarState === 'icons' ? 74 : 0

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar state={sidebarState} onStateChange={setSidebarState} />
      <Topbar sidebarWidth={sidebarWidth} />
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
        <div className="mx-auto max-w-[1360px] px-8 py-7 max-[760px]:px-4">
          {children}
        </div>
      </main>
      <AIAssistant />
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

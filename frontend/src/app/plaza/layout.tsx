import type { ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'
import { PlazaSidebar } from '@/components/plaza/PlazaSidebar'

export default function PlazaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-[#233347] bg-[#2f435b] px-5 text-white">
        <div className="flex h-full items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5" />
            <span className="text-lg font-extrabold">学习广场</span>
            <span className="text-sm text-white/80">使用交流</span>
          </div>
          <div className="text-sm font-bold text-white/90">登录</div>
        </div>
      </header>

      <PlazaSidebar />

      <main className="ml-[260px] min-h-screen pt-16">
        <div className="mx-auto max-w-[1180px] px-6 py-6">{children}</div>
      </main>
    </div>
  )
}

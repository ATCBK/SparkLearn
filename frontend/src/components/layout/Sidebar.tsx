'use client'
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Home,
  PenTool,
  Route,
  User,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { api, MasteryRecord } from '@/lib/api'

type SidebarState = 'expanded' | 'icons' | 'collapsed'

interface SidebarProps {
  state: SidebarState
  onStateChange: (state: SidebarState) => void
}

const GROUPS = [
  {
    title: '学习中心',
    items: [
      { label: '学习工作台', href: '/', icon: Home },
      { label: '学习画像', href: '/profile', icon: User },
      { label: '个性化路径', href: '/path', icon: Route },
    ],
  },
  {
    title: '资源与练习',
    items: [
      { label: '资源中心', href: '/generate', icon: Wand2 },
      { label: '练习评测', href: '/practice', icon: PenTool },
    ],
  },
  {
    title: '分析与反馈',
    items: [{ label: '学习结果', href: '/report', icon: BarChart3 }],
  },
]

export function Sidebar({ state, onStateChange }: SidebarProps) {
  const pathname = usePathname()
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const isExpanded = state === 'expanded'

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getMasteryData()]).then(([m]) => {
      if (!mounted) return
      if (m.status === 'fulfilled') setMastery(m.value)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (state === 'collapsed') return null

  const weakest = [...mastery].sort((a, b) => a.score - b.score)[0]

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-white transition-[width] duration-300',
        isExpanded ? 'w-[232px] px-3 py-[18px]' : 'w-[74px] px-2 py-[18px]',
      )}
    >
      <div className={cn('flex items-center gap-2.5 border-b border-line px-2 pb-5', !isExpanded && 'justify-center px-0')}>
        <img src="/sparklearn-logo.png" alt="SparkLearn" className="h-9 w-[42px] object-contain drop-shadow-sm" />
        {isExpanded && (
          <div>
            <strong className="block text-[17px] leading-tight text-ink">SparkLearn</strong>
            <span className="mt-0.5 block text-[11px] font-extrabold text-muted">第二阶段闭环原型</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto pt-2">
        {GROUPS.map((group) => (
          <div key={group.title}>
            {isExpanded && <div className="mx-2 mb-2 mt-5 text-[11px] font-extrabold tracking-[0.8px] text-soft">{group.title}</div>}
            {group.items.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))}
                collapsed={!isExpanded}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0">
        {isExpanded && (
          <div className="mb-3 rounded-[12px] border border-line bg-[#f9fafb] p-3.5 shadow-sm">
            <b className="block text-small text-ink">今日状态</b>
            <p className="mt-1 text-micro leading-5 text-muted">优先补齐当前卡点，再推进下一阶段。</p>
            <div className="mt-2.5 grid gap-2 text-micro text-muted">
              <Status label="薄弱点" value={weakest?.knowledgePointName || '函数返回值'} />
              <Status label="建议耗时" value="24 分钟" />
              <Status label="路径状态" value="待确认" />
            </div>
          </div>
        )}

        {!isExpanded && (
          <button onClick={() => onStateChange('expanded')} className="sr-only">展开</button>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  label,
  href,
  icon: Icon,
  active,
  collapsed,
}: {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      title={collapsed ? label : undefined}
      className={cn(
        'group relative my-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[#52627b] transition-colors hover:bg-bg-hover hover:text-ink',
        active && 'bg-blue-light text-blue shadow-[inset_3px_0_0_#2563eb]',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="h-[19px] w-[19px] shrink-0" />
      {!collapsed && <span className="text-small font-bold">{label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-2 rounded-md bg-ink px-2 py-1 text-micro text-white opacity-0 transition-opacity group-hover:opacity-100">
          {label}
        </span>
      )}
    </Link>
  )
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <strong className="truncate text-ink">{value}</strong>
    </div>
  )
}

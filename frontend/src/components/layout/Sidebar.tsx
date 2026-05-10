'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Brain,
  ChevronLeft,
  Database,
  Home,
  Library,
  MessageCircle,
  PanelLeftClose,
  PenTool,
  Play,
  RefreshCw,
  Route,
  User,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api, MasteryRecord, StudentProfile } from '@/lib/api'

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
      { label: '学习画像', href: '/profile', icon: Brain },
      { label: '个性化路径', href: '/path', icon: Route },
    ],
  },
  {
    title: '资源与练习',
    items: [
      { label: '资源中心', href: '/generate', icon: Wand2 },
      { label: '资源库', href: '/resources', icon: Library },
      { label: '练习评测', href: '/practice', icon: PenTool },
    ],
  },
  {
    title: '个人知识库',
    items: [{ label: '我的资料库', href: '/knowledge', icon: Database }],
  },
  {
    title: '分析与反馈',
    items: [
      { label: '学习报表', href: '/report', icon: BarChart3 },
      { label: '复习计划', href: '/loop', icon: RefreshCw },
    ],
  },
  {
    title: '工具',
    items: [
      { label: '智能辅导', href: '/tutor', icon: MessageCircle },
      { label: '视频中心', href: '/video', icon: Play },
    ],
  },
]

export function Sidebar({ state, onStateChange }: SidebarProps) {
  const pathname = usePathname()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [mastery, setMastery] = useState<MasteryRecord[]>([])
  const isExpanded = state === 'expanded'

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getProfile(), api.getMasteryData()]).then(([p, m]) => {
      if (!mounted) return
      if (p.status === 'fulfilled') setProfile(p.value)
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
        <BrandLogo size={38} />
        {isExpanded && (
          <div>
            <strong className="block text-[17px] leading-tight text-ink">学而思</strong>
            <span className="mt-0.5 block text-[11px] font-extrabold text-muted">SparkLearn</span>
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
              <Status label="薄弱点" value={weakest?.knowledgePointName || profile?.weakPoints?.[0] || '函数返回值'} />
              <Status label="今日建议" value={`${profile?.dailyTime || 60} 分钟`} />
              <Status label="当前路径" value={profile?.currentStage || '函数与模块'} />
            </div>
          </div>
        )}

        <Link
          href="/profile/settings"
          className={cn(
            'mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-ink-secondary hover:bg-bg-hover hover:text-ink',
            !isExpanded && 'justify-center px-0',
          )}
          title={!isExpanded ? '个人信息' : undefined}
        >
          <User className="h-5 w-5" />
          {isExpanded && <span className="text-small font-bold">个人信息</span>}
        </Link>

        <button
          onClick={() => onStateChange(isExpanded ? 'icons' : 'collapsed')}
          className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink-secondary hover:bg-bg-hover', !isExpanded && 'justify-center px-0')}
          aria-label={isExpanded ? '收起侧栏' : '隐藏侧栏'}
        >
          {isExpanded ? <PanelLeftClose className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {isExpanded && <span className="text-small">收起</span>}
        </button>
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

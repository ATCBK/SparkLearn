'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Route, Library, PenTool, Sparkles, Wand2,
  MessageCircle, BarChart3, Play, User, PanelLeftClose,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { api, StudentProfile } from '@/lib/api'

type SidebarState = 'expanded' | 'icons' | 'collapsed'

interface SidebarProps {
  state: SidebarState
  onStateChange: (state: SidebarState) => void
}

const NAV_ITEMS = [
  { label: '首页总览', href: '/', icon: Home },
  { label: '学习路径', href: '/path', icon: Route },
  { label: '资源中心', href: '/resources', icon: Library },
  { label: '练习与错题', href: '/practice', icon: PenTool },
  { label: '资源推送', href: '/feed', icon: Sparkles },
  { label: '资源生成', href: '/generate', icon: Wand2 },
]

const TOOL_ITEMS = [
  { label: '智能辅导', href: '/tutor', icon: MessageCircle },
  { label: '学习报告', href: '/report', icon: BarChart3 },
  { label: '视频播放', href: '/video', icon: Play },
  { label: '个人信息', href: '/profile', icon: User },
]

export function Sidebar({ state, onStateChange }: SidebarProps) {
  const pathname = usePathname()
  const [quote] = useState('学而不思则罔，思而不学则殆。')
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const isExpanded = state === 'expanded'
  const isProfileActive = pathname === '/profile'

  useEffect(() => {
    let mounted = true
    api.getProfile()
      .then((data) => {
        if (mounted) setProfile(data)
      })
      .catch(() => {
        if (mounted) setProfile(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (state === 'collapsed') return null

  function handleCollapse() {
    if (isExpanded) {
      onStateChange('icons')
    } else {
      onStateChange('collapsed')
    }
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40 bg-bg-sidebar backdrop-blur-[60px] saturate-[200%]',
        'border-r border-black/[0.06] flex flex-col transition-[width] duration-300 ease-out',
        isExpanded ? 'w-[260px]' : 'w-16',
      )}
    >
      <div className={cn('flex items-center gap-3 px-5 h-16 shrink-0', !isExpanded && 'justify-center px-0')}>
        <BrandLogo size={32} />
        {isExpanded && <span className="text-ink font-semibold text-[15px] tracking-tight">SparkLearn</span>}
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href}
            collapsed={!isExpanded}
          />
        ))}

        <div className="my-3 mx-3 border-t border-black/[0.06]" />

        {TOOL_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname === item.href}
            collapsed={!isExpanded}
          />
        ))}
      </nav>

      <div className={cn('px-3 pb-3 space-y-3 shrink-0', !isExpanded && 'px-2')}>
        {isExpanded && (
          <div className="px-3 py-2 rounded-lg bg-bg-hover/50">
            <p className="text-[11px] text-ink-tertiary italic leading-relaxed">&ldquo;{quote}&rdquo;</p>
          </div>
        )}

        <div className="border-t border-black/[0.06]" />

        <Link
          href="/profile"
          prefetch={false}
          title={!isExpanded ? '个人信息' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative group',
            isProfileActive
              ? 'bg-blue-light text-blue'
              : 'text-ink-secondary hover:bg-bg-hover hover:text-ink',
            !isExpanded && 'justify-center px-0',
          )}
        >
          {isProfileActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue rounded-r-full" />
          )}
          <div className="w-8 h-8 rounded-full bg-blue-light flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-blue" />
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="text-small font-medium text-ink truncate">{profile?.name || '张同学'}</p>
              <p className="text-micro text-ink-tertiary truncate">
                {profile ? `${profile.major || '未填写专业'} · ${profile.grade || '未填写年级'}` : '计算机科学 · 大二'}
              </p>
            </div>
          )}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-ink text-white text-micro rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              个人信息
            </div>
          )}
        </Link>

        <button
          onClick={handleCollapse}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-ink-secondary',
            'hover:bg-bg-hover transition-colors',
            !isExpanded && 'justify-center px-0',
          )}
          aria-label={isExpanded ? '收起侧栏' : '展开侧栏'}
        >
          {isExpanded ? (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="text-small">收起</span>
            </>
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
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
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group',
        active
          ? 'bg-blue-light text-blue'
          : 'text-ink-secondary hover:bg-bg-hover hover:text-ink',
        collapsed && 'justify-center px-0',
      )}
      title={collapsed ? label : undefined}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue rounded-r-full" />
      )}
      <Icon className={cn('w-5 h-5 shrink-0', collapsed && 'w-5 h-5')} />
      {!collapsed && (
        <span className="text-small font-medium">{label}</span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-ink text-white text-micro rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {label}
        </div>
      )}
    </Link>
  )
}


'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  Database,
  Paperclip,
  Plus,
  Puzzle,
  Settings2,
  Sparkles,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { TutorUserBadge } from '@/components/tutor/TutorUserBadge'

type TutorSidebarProps = {
  onNewConversation?: () => void
}

type TutorMenuItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

const PRIMARY_ITEMS: TutorMenuItem[] = [
  { href: '/tutor', label: '学习空间', icon: Sparkles, exact: true },
  { href: '/tutor/roles', label: '角色工坊', icon: UserCog },
  { href: '/tutor/workshop', label: '研讨会', icon: Users },
]

const RESOURCE_ITEMS: TutorMenuItem[] = [
  { href: '/tutor/knowledge', label: '知识库', icon: Database },
  { href: '/tutor/mcp-store', label: 'MCP 插件商店', icon: Puzzle },
  { href: '/tutor/skills', label: 'Skills 商店', icon: Sparkles },
  { href: '/tutor/model-settings', label: '模型配置', icon: Settings2 },
  { href: '/tutor/files', label: '我的文件', icon: Paperclip },
]

function TutorMenuLink({ item, pathname }: { item: TutorMenuItem; pathname: string }) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm transition-colors',
        active
          ? 'bg-[#2563eb] font-medium text-white shadow-sm'
          : 'text-[#475569] hover:bg-white hover:text-[#1e293b]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export function TutorSidebar({ onNewConversation }: TutorSidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="智能辅导功能菜单"
      className="flex w-[200px] shrink-0 flex-col border-r border-[#e2e8f0] bg-[#f0f4ff] max-[760px]:hidden"
    >
      <div className="border-b border-[#e2e8f0] p-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/sparklearn-logo-official.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[#1e293b]">学而思 SparkLearn</div>
            <div className="truncate text-[10px] text-[#94a3b8]">个性化学习闭环</div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {onNewConversation ? (
          <button
            type="button"
            onClick={onNewConversation}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8]"
          >
            <Plus className="h-4 w-4" />
            新建对话
          </button>
        ) : (
          <Link
            href="/tutor"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8]"
          >
            <Plus className="h-4 w-4" />
            新建对话
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-0.5 px-3">
        {PRIMARY_ITEMS.map((item) => (
          <TutorMenuLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="my-3 border-t border-[#e2e8f0]" />
        {RESOURCE_ITEMS.map((item) => (
          <TutorMenuLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="space-y-2 border-t border-[#e2e8f0] p-3">
        <Link
          href="/"
          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-[#475569] transition-colors hover:bg-white hover:text-[#1e293b]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          返回主平台
        </Link>
        <TutorUserBadge />
      </div>
    </nav>
  )
}

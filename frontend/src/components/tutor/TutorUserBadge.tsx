'use client'

import { useCurrentUserDisplay } from '@/hooks/useCurrentUserDisplay'

export function TutorUserBadge() {
  const user = useCurrentUserDisplay()

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="用户头像" className="h-8 w-8 rounded-full object-cover ring-1 ring-[#e5e7eb]" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] text-xs font-bold text-white">
          {user.nameChar}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#1e293b]">{user.name}</p>
        <p className="text-[11px] text-[#94a3b8]">学习平台</p>
      </div>
    </div>
  )
}

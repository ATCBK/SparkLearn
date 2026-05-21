'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 教师大屏入口 — 直接重定向到静态大屏页面
 * 大屏文件位于 /screen/index.html（public 目录）
 */
export default function TeacherPage() {
  const router = useRouter()

  useEffect(() => {
    // 在新标签页打开大屏，保留当前学生端
    window.open('/screen/index.html', '_blank')
    // 返回上一页
    router.back()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#051655]">
      <div className="text-center text-white">
        <div className="mb-4 text-4xl">📊</div>
        <p className="text-lg font-bold">正在打开教师大屏...</p>
        <p className="mt-2 text-sm text-white/50">大屏将在新标签页中打开</p>
      </div>
    </div>
  )
}

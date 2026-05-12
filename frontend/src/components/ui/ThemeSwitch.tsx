'use client'

import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeSwitch() {
  const [isDark, setIsDark] = useState(false)

  const toggle = () => {
    setIsDark(!isDark)
    // TODO: 接入完整主题系统后切换 document class
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#52627B] hover:bg-[#F3F4F6] transition-colors"
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span>{isDark ? '深色模式' : '浅色模式'}</span>
    </button>
  )
}

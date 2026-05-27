'use client'

import { cn } from '@/lib/utils/cn'

type IconBlockColor = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal' | 'pink'
type IconBlockSize = 'sm' | 'md' | 'lg'

const COLOR_MAP: Record<IconBlockColor, { bg: string; text: string }> = {
  blue: { bg: 'bg-[#eff6ff]', text: 'text-[#2563eb]' },
  purple: { bg: 'bg-[#f3efff]', text: 'text-[#7c3aed]' },
  green: { bg: 'bg-[#ecfdf5]', text: 'text-[#059669]' },
  orange: { bg: 'bg-[#fff7ed]', text: 'text-[#d97706]' },
  red: { bg: 'bg-[#fef2f2]', text: 'text-[#dc2626]' },
  teal: { bg: 'bg-[#ecfeff]', text: 'text-[#0891b2]' },
  pink: { bg: 'bg-[#fdf2f8]', text: 'text-[#db2777]' },
}

const SIZE_MAP: Record<IconBlockSize, { block: string; icon: string }> = {
  sm: { block: 'h-8 w-8 rounded-lg', icon: '[&>svg]:h-4 [&>svg]:w-4' },
  md: { block: 'h-10 w-10 rounded-xl', icon: '[&>svg]:h-5 [&>svg]:w-5' },
  lg: { block: 'h-12 w-12 rounded-xl', icon: '[&>svg]:h-6 [&>svg]:w-6' },
}

interface IconBlockProps {
  icon: React.ReactNode
  color?: IconBlockColor
  size?: IconBlockSize
  className?: string
}

/**
 * 彩色圆角底块 + Lucide 线性图标
 *
 * 用法：
 * ```tsx
 * import { FileText } from 'lucide-react'
 * <IconBlock icon={<FileText />} color="blue" />
 * <IconBlock icon={<BarChart3 />} color="purple" size="lg" />
 * ```
 */
export function IconBlock({ icon, color = 'blue', size = 'md', className }: IconBlockProps) {
  const c = COLOR_MAP[color]
  const s = SIZE_MAP[size]

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        c.bg,
        c.text,
        s.block,
        s.icon,
        className
      )}
    >
      {icon}
    </div>
  )
}

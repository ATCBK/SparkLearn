import { cn } from '@/lib/utils/cn'

interface ProgressBarProps {
  value: number // 0-100
  className?: string
  showLabel?: boolean
  color?: 'blue' | 'success' | 'warning' | 'danger' | 'gradient'
}

export function ProgressBar({ value, className, showLabel = false, color = 'blue' }: ProgressBarProps) {
  const colorClass = {
    blue: 'bg-blue',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    gradient: 'bg-gradient-to-r from-blue to-teal',
  }[color]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 h-2 bg-bg-hover rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-800 ease-out',
            colorClass,
          )}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-caption text-ink-secondary tabular-nums min-w-[3ch]">
          {Math.round(value)}%
        </span>
      )}
    </div>
  )
}

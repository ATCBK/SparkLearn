import { cn } from '@/lib/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  size?: 'sm' | 'md'
}

export function Badge({ variant = 'default', size = 'sm', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill font-medium',
        size === 'sm' && 'px-2 py-0.5 text-micro',
        size === 'md' && 'px-3 py-1 text-caption',

        variant === 'default' && 'bg-bg-hover text-ink-secondary',
        variant === 'success' && 'bg-success/10 text-success',
        variant === 'warning' && 'bg-warning/10 text-warning',
        variant === 'danger' && 'bg-danger/10 text-danger',
        variant === 'info' && 'bg-blue-light text-blue',
        variant === 'purple' && 'bg-purple/10 text-purple',
      )}
    >
      {children}
    </span>
  )
}

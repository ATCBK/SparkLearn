import { cn } from '@/lib/utils/cn'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-small font-medium text-ink">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-10 px-4 rounded-[12px] border border-black/[0.08] bg-bg-card',
            'text-body text-ink placeholder:text-ink-disabled',
            'focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue',
            'transition-all duration-200',
            error && 'border-danger focus:ring-danger/20 focus:border-danger',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-caption text-danger">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

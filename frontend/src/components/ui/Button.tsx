import { cn } from '@/lib/utils/cn'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-[6px] transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Variants
          variant === 'primary' && [
            'bg-blue text-white hover:bg-blue-dark active:scale-[0.98]',
            'shadow-sm shadow-[inset_0_0_8px_rgba(0,0,0,0.15)] hover:shadow-md',
          ],
          variant === 'secondary' && [
            'bg-bg-card text-ink border border-black/[0.08]',
            'hover:bg-bg-hover active:scale-[0.98]',
          ],
          variant === 'ghost' && [
            'text-ink-secondary hover:text-ink hover:bg-bg-hover',
          ],

          // Sizes
          size === 'sm' && 'h-8 px-3 text-small gap-1.5',
          size === 'md' && 'h-10 px-4 text-body gap-2',
          size === 'lg' && 'h-12 px-6 text-h3 gap-2.5',

          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

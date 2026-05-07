import { cn } from '@/lib/utils/cn'
import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  variant?: 'default' | 'dark'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, variant = 'default', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[20px] transition-all duration-250',
          variant === 'default' && [
            'bg-bg-card shadow-sm',
            hoverable && 'hover:shadow-md hover:-translate-y-[3px] cursor-pointer',
          ],
          variant === 'dark' && [
            'bg-gradient-to-br from-ink to-[#2c2c2e] text-white',
            hoverable && 'hover:shadow-xl cursor-pointer',
          ],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

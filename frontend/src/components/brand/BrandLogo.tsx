'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface BrandLogoProps {
  size?: number
  className?: string
  rounded?: boolean
  alt?: string
}

export function BrandLogo({
  size = 32,
  className,
  rounded = true,
  alt = 'SparkLearn Logo',
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden shrink-0',
        rounded ? 'rounded-[10px]' : '',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-v2.png"
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-contain"
        priority={size >= 32}
      />
    </div>
  )
}


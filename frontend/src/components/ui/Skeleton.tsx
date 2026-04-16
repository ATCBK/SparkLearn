import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[12px] bg-bg-hover',
        className,
      )}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Featured Card */}
      <Skeleton className="h-48 w-full rounded-[20px]" />
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-[20px]" />
        ))}
      </div>
      {/* Content Grid */}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="space-y-3">
          <Skeleton className="h-64 rounded-[20px]" />
          <Skeleton className="h-48 rounded-[20px]" />
        </div>
        <Skeleton className="h-96 rounded-[20px]" />
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

export function ProtoCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section style={style} className={cn('rounded-[12px] border border-line bg-white p-5 shadow-md', className)}>
      {children}
    </section>
  )
}

export function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-[10px] border border-[#eef2f7] bg-[#f9fafb] p-3.5', className)}>{children}</div>
}

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'blue' | 'green' | 'orange' | 'red' | 'purple'
  className?: string
}) {
  const tones = {
    neutral: 'bg-[#f1f6fc] text-[#52627b]',
    blue: 'bg-blue-light text-blue',
    green: 'bg-green-light text-green',
    orange: 'bg-orange-light text-orange',
    red: 'bg-red-light text-red',
    purple: 'bg-purple-light text-purple',
  }
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-micro font-bold whitespace-nowrap', tones[tone], className)}>{children}</span>
}

export function ProtoButton({
  children,
  variant = 'primary',
  href,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost'
  href?: string
}) {
  const variants = {
    primary: 'bg-blue text-white hover:bg-blue-dark',
    secondary: 'bg-white text-blue ring-1 ring-[#bfdbfe] hover:bg-blue-light',
    tertiary: 'bg-[#f2f6fb] text-ink hover:bg-[#eaf0f7]',
    ghost: 'bg-transparent text-blue hover:bg-blue-light px-1',
  }
  const cls = cn('inline-flex h-9 items-center justify-center gap-2 rounded-[8px] px-3.5 text-small font-bold transition-colors disabled:opacity-50', variants[variant], className)
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>
  }
  return <button className={cls} {...props}>{children}</button>
}

const chipTones = {
  blue: { bg: 'bg-[#eff6ff]', text: 'text-[#2563eb]' },
  green: { bg: 'bg-[#ecfdf5]', text: 'text-[#059669]' },
  orange: { bg: 'bg-[#fff7ed]', text: 'text-[#d97706]' },
  purple: { bg: 'bg-[#f3efff]', text: 'text-[#7c3aed]' },
  cyan: { bg: 'bg-[#ecfeff]', text: 'text-[#0891b2]' },
  red: { bg: 'bg-[#fef2f2]', text: 'text-[#dc2626]' },
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
  chips,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: React.ReactNode
  chips?: Array<{ value: string; label: string; icon?: React.ReactNode; tone?: keyof typeof chipTones }>
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-6 border-b border-line pb-4">
      <div className="min-w-0">
        <div className="mb-2 text-small font-extrabold text-soft">{eyebrow}</div>
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-h1 font-bold leading-tight tracking-normal text-ink">{title}</h1>
          {actions}
        </div>
        {description && <p className="mt-2 max-w-[760px] text-body leading-7 text-muted">{description}</p>}
      </div>
      {chips && (
        <div className="flex shrink-0 items-center gap-2.5">
          {chips.map((chip) => {
            const tone = chip.tone ? chipTones[chip.tone] : null
            return (
              <div key={chip.label} className="group relative min-w-[118px] overflow-hidden rounded-[12px] border border-line bg-white px-3.5 py-2.5 shadow-sm transition-shadow hover:shadow-md">
                {/* 装饰性渐变角标 */}
                {tone && (
                  <div className={cn('absolute -right-2 -top-2 h-8 w-8 rounded-full opacity-30', tone.bg)} />
                )}
                <div className="relative flex items-center gap-2.5">
                  {chip.icon && tone && (
                    <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tone.bg, tone.text)}>
                      {chip.icon}
                    </div>
                  )}
                  <div>
                    <b className="block text-[16px] leading-tight text-ink">{chip.value}</b>
                    <span className="mt-0.5 block text-micro text-muted">{chip.label}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </header>
  )
}

export function MetricStrip({ items }: { items: Array<{ value: string; label: string }> }) {
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-line bg-white shadow-md max-[760px]:grid-cols-2">
      {items.map((item, idx) => (
        <div key={item.label} className={cn('p-4', idx !== items.length - 1 && 'border-r border-[#eef2f7] max-[760px]:border-r-0')}>
          <b className="block text-[20px] text-ink">{item.value}</b>
          <span className="mt-1 block text-micro leading-5 text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Bar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' }) {
  const colors = { blue: 'bg-blue', green: 'bg-green', orange: 'bg-orange', red: 'bg-red', purple: 'bg-purple' }
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e8eff8]">
      <div className={cn('h-full rounded-full', colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function ProgressRing({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="grid h-[116px] w-[116px] place-items-center rounded-full border border-[#eef3f9]"
      style={{
        background: `radial-gradient(circle at center, #fff 0 40px, transparent 41px), conic-gradient(#2563eb 0 ${value}%, #e8eff8 ${value}% 100%)`,
      }}
    >
      <div className="text-center">
        <b className="block text-[28px] leading-none">{value}%</b>
        {label && <span className="mt-0.5 block text-[11px] text-muted">{label}</span>}
      </div>
    </div>
  )
}

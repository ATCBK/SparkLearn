// 日期工具函数

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateCN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDateRange(start: Date | string, end: Date | string): string {
  return `${formatDateCN(start)} - ${formatDateCN(end)}`
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function diffDays(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : start
  const e = typeof end === 'string' ? new Date(end) : end
  const ms = e.getTime() - s.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function startOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfWeek(date: Date | string): Date {
  const start = startOfWeek(date)
  return addDays(start, 6)
}

export function generateDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

export function groupDatesByMonth(dates: Date[]): Map<string, Date[]> {
  const groups = new Map<string, Date[]>()
  dates.forEach((date) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(date)
  })
  return groups
}

export function getWeekLabel(date: Date): string {
  const weekStart = startOfWeek(date)
  return formatDateCN(weekStart)
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

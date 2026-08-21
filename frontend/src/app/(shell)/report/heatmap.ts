export type ViewMode = 'day' | 'week' | 'month'

export type HeatmapCell = number | null
export type HeatmapData = HeatmapCell[][]

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date)
  next.setDate(next.getDate() + days)
  return next
}

function periodStart(date: Date, mode: ViewMode): Date {
  if (mode === 'day') return startOfDay(date)
  if (mode === 'week') return getWeekStart(date)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function seededNumber(date: Date): number {
  const dateKey =
    date.getFullYear() * 10_000_000
    + (date.getMonth() + 1) * 100_000
    + date.getDate() * 1_000
    + date.getHours()
  let value = Math.imul(dateKey ^ 0x9e3779b9, 0x85ebca6b)
  value ^= value >>> 13
  value = Math.imul(value, 0xc2b2ae35)
  return (value ^ (value >>> 16)) >>> 0
}

function mockStudyIntensity(date: Date): number {
  const hour = date.getHours()
  const seed = seededNumber(date)
  const activityChance = hour < 7
    ? 3
    : hour < 9
      ? 34
      : hour < 12
        ? 58
        : hour < 14
          ? 24
          : hour < 18
            ? 52
            : hour < 23
              ? 72
              : 12

  if (seed % 100 >= activityChance) return 0
  return 1 + (Math.floor(seed / 100) % 4)
}

function generateDay(date: Date, now: Date): HeatmapCell[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const slot = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour)
    return slot > now ? null : mockStudyIntensity(slot)
  })
}

export function generateHeatmapData(
  mode: ViewMode,
  selectedDate: Date,
  now: Date = new Date(),
): HeatmapData {
  if (mode === 'day') {
    return [generateDay(startOfDay(selectedDate), now)]
  }

  if (mode === 'week') {
    const weekStart = getWeekStart(selectedDate)
    return Array.from({ length: 7 }, (_, dayIndex) => generateDay(addDays(weekStart, dayIndex), now))
  }

  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Array.from(
    { length: daysInMonth },
    (_, dayIndex) => generateDay(new Date(year, month, dayIndex + 1), now),
  )
}

export function canNavigateToNextPeriod(
  mode: ViewMode,
  selectedDate: Date,
  now: Date = new Date(),
): boolean {
  return periodStart(moveReportPeriod(selectedDate, mode, 1), mode) <= periodStart(now, mode)
}

export function getWeekStart(date: Date): Date {
  const result = startOfDay(date)
  const daysSinceMonday = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - daysSinceMonday)
  return result
}

export function moveReportPeriod(date: Date, mode: ViewMode, direction: -1 | 1): Date {
  if (mode === 'day') return addDays(date, direction)
  if (mode === 'week') return addDays(getWeekStart(date), direction * 7)
  return new Date(date.getFullYear(), date.getMonth() + direction, 1)
}

'use client'

import type { GanttZoom } from '../hooks/gantt'
import { diffDays, startOfMonth } from '../utils/dateUtils'

interface Props {
  startDate: Date
  totalColumns: number
  zoom: GanttZoom
  totalHeight: number
}

export function GanttTodayLine({ startDate, totalColumns, zoom, totalHeight }: Props) {
  const today = new Date()
  let index = 0

  switch (zoom) {
    case 'day':
      index = diffDays(startDate, today)
      break
    case 'week':
      index = Math.floor(diffDays(startDate, today) / 7)
      break
    case 'month': {
      const startMonth = startOfMonth(startDate)
      const todayMonth = startOfMonth(today)
      index = (todayMonth.getFullYear() - startMonth.getFullYear()) * 12 + (todayMonth.getMonth() - startMonth.getMonth())
      break
    }
  }

  if (index < 0 || index >= totalColumns) return null

  const left = `${(index / totalColumns) * 100}%`

  return (
    <div className="pointer-events-none absolute top-0 z-20" style={{ left, height: `${totalHeight}px` }}>
      <div className="h-full w-[2px] bg-[#2563EB]" />
    </div>
  )
}

'use client'

import type { GanttZoom } from '../hooks/gantt'
import { formatDateCN } from '../utils/dateUtils'

export type TimelineColumn = {
  key: string
  date: Date
  label: string
  subLabel?: string
  isToday?: boolean
  isWeekend?: boolean
  showLabel?: boolean
}

interface Props {
  zoom: GanttZoom
  columns: TimelineColumn[]
}

export function GanttTimeline({ zoom, columns }: Props) {
  const gridTemplateColumns = `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`
  const zoomLabel = zoom === 'day' ? '日视图' : zoom === 'week' ? '周视图' : '月视图'

  return (
    <div className="border-b border-[#E5EAF2] bg-white">
      <div className="flex items-center justify-between px-4 py-2 text-[11px] text-[#94A3B8]">
        <span>{zoomLabel}</span>
        <span>{columns.length > 0 ? formatDateCN(columns[0].date) + ' - ' + formatDateCN(columns[columns.length - 1].date) : ''}</span>
      </div>

      <div className="grid h-14 border-t border-[#F3F4F6]" style={{ gridTemplateColumns }}>
        {columns.map((column) => (
          <div
            key={column.key}
            className={`flex flex-col items-center justify-center border-r border-[#F3F4F6] px-2 text-center text-[10px] leading-tight ${
              column.isToday
                ? 'bg-[#EFF6FF] font-bold text-[#2563EB]'
                : column.isWeekend
                  ? 'bg-[#FAFBFC] text-[#9CA3AF]'
                  : 'text-[#6B7280]'
            }`}
          >
            {column.showLabel !== false ? <span className="truncate font-bold">{column.label}</span> : <span className="h-4" />}
            {column.showLabel !== false && column.subLabel ? <span className="mt-1 truncate text-[9px]">{column.subLabel}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

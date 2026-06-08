'use client'

import { useMemo } from 'react'
import type { GanttTask, GanttZoom } from '../hooks/gantt'
import { dateToX, getTaskBarWidth, PHASE_COLORS } from '../utils/ganttUtils'
import { formatDateCN, diffDays, addDays, formatDate } from '../utils/dateUtils'

interface GanttTaskBarProps {
  task: GanttTask
  startDate: Date
  cellWidth: number
  zoom: GanttZoom
  isSelected: boolean
  isHovered: boolean
  onClick: () => void
  onHover: (hovered: boolean) => void
  onProgressChange?: (taskId: string, progress: number) => void
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void
}

export function GanttTaskBar({
  task,
  startDate,
  cellWidth,
  zoom,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onDateChange,
}: GanttTaskBarProps) {
  const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS.目标

  const { left, width } = useMemo(() => {
    return {
      left: dateToX(task.startDate, startDate, cellWidth, zoom),
      width: getTaskBarWidth(task.startDate, task.endDate, cellWidth, zoom),
    }
  }, [task.startDate, task.endDate, startDate, cellWidth, zoom])

  const dayWidth = useMemo(() => {
    const days = Math.max(1, diffDays(task.startDate, task.endDate) + 1)
    return width / days
  }, [task.startDate, task.endDate, width])

  const handleLeftEdgeDrag = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task) return
    const startX = e.clientX
    const originalStart = task.startDate
    const originalEnd = task.endDate
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / dayWidth)
      const newStart = addDays(originalStart, deltaDays)
      if (newStart < new Date(originalEnd)) {
        onDateChange?.(task.id, formatDate(newStart), originalEnd)
      }
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleRightEdgeDrag = (e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const originalStart = task.startDate
    const originalEnd = task.endDate
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / dayWidth)
      const newEnd = addDays(originalEnd, deltaDays)
      if (newEnd > new Date(originalStart)) {
        onDateChange?.(task.id, originalStart, formatDate(newEnd))
      }
    }
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className="relative h-[52px] flex items-center group"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        onClick={onClick}
        className={`absolute h-8 rounded-[6px] cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
        } ${isHovered ? 'shadow-md' : 'shadow-sm'}`}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: task.status === 'completed' ? '#D1FAE5' : phaseColor.light,
          borderLeft: `3px solid ${phaseColor.fill}`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-r-[4px]"
          style={{ width: `${task.progress}%`, backgroundColor: phaseColor.fill, opacity: 0.24 }}
        />
        <div className="absolute inset-0 flex items-center justify-between gap-2 px-3 text-[11px] font-bold text-[#111827]">
          <span className="truncate">{task.title}</span>
          <span className="flex-shrink-0">{task.progress}%</span>
        </div>

        {onDateChange ? (
          <>
            <div className="absolute inset-y-0 left-0 w-3 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={handleLeftEdgeDrag} />
            <div className="absolute inset-y-0 right-0 w-3 cursor-col-resize opacity-0 transition-opacity group-hover:opacity-100" onMouseDown={handleRightEdgeDrag} />
          </>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-[10px] border border-[#E5EAF2] bg-white p-3 text-xs shadow-lg group-hover:block">
        <div className="font-bold text-[#111827]">{task.title}</div>
        <div className="mt-1 text-[#6B7280]">{formatDateCN(task.startDate)} - {formatDateCN(task.endDate)}</div>
      </div>
    </div>
  )
}

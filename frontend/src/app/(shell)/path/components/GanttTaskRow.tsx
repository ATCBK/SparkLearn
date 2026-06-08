'use client'

import { useMemo } from 'react'
import type { GanttTask, GanttZoom } from '../hooks/gantt'
import { dateToX, getTaskBarWidth, PHASE_COLORS, STATUS_COLORS, STATUS_TEXT } from '../utils/ganttUtils'
import { formatDateCN, diffDays, addDays, formatDate } from '../utils/dateUtils'

interface GanttTaskRowProps {
  task?: GanttTask
  nodeTitle: string
  nodeIndex: number
  nodeId: string
  isCompleted: boolean
  phaseColor: string
  startDate: Date
  cellWidth: number
  zoom: GanttZoom
  isSelected: boolean
  isHovered: boolean
  onClick: () => void
  onHover: (hovered: boolean) => void
  onProgressChange?: (taskId: string, progress: number) => void
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void
  onTaskComplete?: (taskId: string, completed: boolean) => void
  totalWidth: number
}

export function GanttTaskRow({
  task,
  nodeTitle,
  nodeIndex,
  isCompleted,
  phaseColor,
  startDate,
  cellWidth,
  zoom,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onDateChange,
  onTaskComplete,
  totalWidth,
}: GanttTaskRowProps) {
  const barStyle = useMemo(() => {
    if (!task) return null
    return {
      left: dateToX(task.startDate, startDate, cellWidth, zoom),
      width: getTaskBarWidth(task.startDate, task.endDate, cellWidth, zoom),
    }
  }, [task, startDate, cellWidth, zoom])

  const dayWidth = useMemo(() => {
    if (!task || !barStyle) return cellWidth
    const days = Math.max(1, diffDays(task.startDate, task.endDate) + 1)
    return barStyle.width / days
  }, [task, barStyle, cellWidth])

  const handleLeftEdgeDrag = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDateChange || !task) return

    const startX = e.clientX
    const originalStart = task.startDate
    const originalEnd = task.endDate

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / dayWidth)
      const newStart = addDays(originalStart, deltaDays)
      if (newStart < new Date(originalEnd)) {
        onDateChange(task.id, formatDate(newStart), originalEnd)
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
    if (!onDateChange || !task) return

    const startX = e.clientX
    const originalStart = task.startDate
    const originalEnd = task.endDate

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - startX) / dayWidth)
      const newEnd = addDays(originalEnd, deltaDays)
      if (newEnd > new Date(originalStart)) {
        onDateChange(task.id, originalStart, formatDate(newEnd))
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
    <div className="flex h-[52px] border-b border-[#F3F4F6] group" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <button
        type="button"
        className={`flex w-[320px] flex-shrink-0 items-center gap-3 border-r border-[#E5EAF2] px-4 text-left transition-colors ${
          isSelected ? 'bg-[#F0F7FF]' : isHovered ? 'bg-[#FAFBFC]' : 'bg-white'
        }`}
        onClick={onClick}
      >
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
          style={{ borderColor: isCompleted ? '#16A34A' : '#D1D5DB', color: isCompleted ? '#16A34A' : '#6B7280' }}
        >
          {nodeIndex}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-bold ${isCompleted ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'}`}>{nodeTitle}</div>
          {task ? <div className="mt-0.5 text-[10px] text-[#9CA3AF]">{formatDateCN(task.startDate)} - {formatDateCN(task.endDate)}</div> : null}
        </div>
      </button>

      <div className="relative flex-1">
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: Math.ceil(totalWidth / cellWidth) }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-px bg-[#F3F4F6]" style={{ left: `${i * cellWidth}px` }} />
          ))}
        </div>

        {task && barStyle ? (
          <div
            className={`absolute top-2 h-8 rounded-[6px] cursor-pointer transition-all ${
              isSelected ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
            } ${isHovered ? 'shadow-md' : 'shadow-sm'}`}
            style={{
              left: `${barStyle.left}px`,
              width: `${barStyle.width}px`,
              backgroundColor: isCompleted ? '#D1FAE5' : `${phaseColor}15`,
              borderLeft: `3px solid ${phaseColor}`,
            }}
            onClick={onClick}
          >
            {onDateChange ? <div className="absolute inset-y-0 left-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100" onMouseDown={handleLeftEdgeDrag} /> : null}
            <div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${task.progress}%`, backgroundColor: phaseColor, opacity: 0.24 }} />
            <div className="absolute inset-0 flex items-center px-3 text-xs font-bold text-[#111827]">
              <span className="truncate flex-1">{task.progress}%</span>
            </div>
            {onDateChange ? <div className="absolute inset-y-0 right-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100" onMouseDown={handleRightEdgeDrag} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

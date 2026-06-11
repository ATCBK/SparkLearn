'use client'

import { useMemo } from 'react'
import type { EditablePhase } from '@/lib/api/types'
import type { GanttTask, GanttZoom } from '../hooks/gantt'
import { GanttTimeline, type TimelineColumn } from './GanttTimeline'
import { addDays, addMonths, diffDays, formatDateCN, isToday, isWeekend, startOfMonth, startOfWeek } from '../utils/dateUtils'

interface Props {
  phases: EditablePhase[]
  tasks: GanttTask[]
  zoom: GanttZoom
  selectedTaskId: string | null
  hoveredTaskId: string | null
  onTaskSelect: (taskId: string | null) => void
  onTaskHover: (taskId: string | null) => void
  onProgressChange?: (taskId: string, progress: number) => void
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void
  onTaskComplete?: (taskId: string, completed: boolean) => void
}

const LEFT_WIDTH = 320
const ROW_HEIGHT = 56

export function GanttContainer({
  phases,
  tasks,
  zoom,
  selectedTaskId,
  hoveredTaskId,
  onTaskSelect,
  onTaskHover,
}: Props) {
  const { columns, rangeStart, rangeEnd } = useMemo(() => buildTimeline(tasks, zoom), [tasks, zoom])
  const totalColumns = Math.max(columns.length, 1)

  const phaseRows = useMemo(() => {
    const taskMap = new Map<number, GanttTask[]>()
    phases.forEach((phase) => taskMap.set(phase.id, []))
    tasks.forEach((task) => {
      if (!taskMap.has(task.phaseId)) taskMap.set(task.phaseId, [])
      taskMap.get(task.phaseId)!.push(task)
    })

    return phases
      .map((phase) => ({
        ...phase,
        tasks:
          zoom === 'day'
            ? (taskMap.get(phase.id) || []).filter((task) => isTaskVisibleInWindow(task, rangeStart, rangeEnd))
            : taskMap.get(phase.id) || [],
      }))
      .filter((phase) => phase.tasks.length > 0)
  }, [phases, tasks, zoom, rangeStart, rangeEnd])

  return (
    <div className="w-full overflow-hidden rounded-[14px] border border-[#E5EAF2] bg-white">
      <GanttTimeline zoom={zoom} columns={columns} />

      <div className="divide-y divide-[#E5EAF2]">
        {phaseRows.map((phase) => {
          const phaseColor = getPhaseColor(phase.id)
          return (
            <section key={phase.id}>
              <div className="flex items-center justify-between bg-[#FAFBFC] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phaseColor.fill }} />
                  <span className="text-sm font-bold text-[#111827]">{phase.title}</span>
                </div>
                <span className="text-xs text-[#94A3B8]">共 {phase.tasks.length} 步</span>
              </div>

              <div>
              {phase.tasks.map((task) => {
                const span = getTaskSpan(task, rangeStart, zoom, totalColumns)
                const color = getPhaseColor(task.phaseId)
                const isSelected = selectedTaskId === task.id
                const isHovered = hoveredTaskId === task.id

                return (
                  <div key={task.id} className="flex h-[56px] border-t border-[#F3F4F6]">
                    <button
                      type="button"
                      onClick={() => onTaskSelect(task.id)}
                      onMouseEnter={() => onTaskHover(task.id)}
                      onMouseLeave={() => onTaskHover(null)}
                      className={`flex w-80 flex-shrink-0 items-center gap-3 border-r border-[#E5EAF2] px-4 text-left transition-colors ${
                        isSelected ? 'bg-[#F0F7FF]' : isHovered ? 'bg-[#FAFBFC]' : 'bg-white'
                      }`}
                    >
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D1D5DB] text-[10px] font-bold text-[#6B7280]">
                        {task.nodeIndex}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-sm font-bold ${task.status === 'completed' ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'}`}>
                          {task.title}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                          {formatDateCN(task.startDate)} - {formatDateCN(task.endDate)}
                        </div>
                      </div>
                    </button>

                    <div className="relative flex-1 bg-white">
                      <div
                        className="absolute inset-0 grid pointer-events-none"
                        style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
                      >
                        {columns.map((column) => (
                          <div key={column.key} className="border-r border-[#F3F4F6]" />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => onTaskSelect(task.id)}
                        className={`absolute top-1.5 h-8 rounded-[8px] border text-left transition-all ${
                          isSelected ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
                        } ${isHovered ? 'shadow-md' : 'shadow-sm'}`}
                        style={{
                          left: `${(span.startIndex / totalColumns) * 100}%`,
                          width: `${(span.width / totalColumns) * 100}%`,
                          minWidth: '18px',
                          backgroundColor: task.status === 'completed' ? '#ECFDF5' : color.light,
                          borderLeft: `3px solid ${color.fill}`,
                          borderColor: `${color.border}55`,
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-r-[7px]"
                          style={{ width: `${task.progress}%`, backgroundColor: color.fill, opacity: 0.22 }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between gap-2 px-3 text-[11px] font-bold text-[#111827]">
                          <span className="truncate">{task.progress}%</span>
                          <span className="truncate text-[#6B7280]">{task.status === 'completed' ? '已完成' : ''}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )
              })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function buildTimeline(tasks: GanttTask[], zoom: GanttZoom): { columns: TimelineColumn[]; rangeStart: Date; rangeEnd: Date } {
  const today = new Date()
  const taskDates = tasks.length
    ? tasks.flatMap((task) => [new Date(task.startDate), new Date(task.endDate)])
    : [today]

  const minDate = new Date(Math.min(...taskDates.map((date) => date.getTime())))
  const maxDate = new Date(Math.max(...taskDates.map((date) => date.getTime())))

  if (zoom === 'day') {
    const start = startOfWeek(today)
    const end = addDays(start, 6)
    const columns: TimelineColumn[] = []

    for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
      columns.push({
        key: current.toISOString(),
        date: new Date(current),
        label: current.getMonth() + 1 + '月' + current.getDate() + '日',
        subLabel: weekdayName(current),
        isToday: isToday(current),
        isWeekend: isWeekend(current),
        showLabel: true,
      })
    }

    return { columns: columns.length > 0 ? columns : [createFallbackColumn(today)], rangeStart: start, rangeEnd: end }
  }

  if (zoom === 'week') {
    const start = startOfWeek(minDate)
    const end = startOfWeek(maxDate)
    const columns: TimelineColumn[] = []

    for (let current = new Date(start); current <= end; current = addDays(current, 7)) {
      columns.push({
        key: current.toISOString(),
        date: new Date(current),
        label: '第 ' + (Math.floor(diffDays(start, current) / 7) + 1) + ' 周',
        subLabel: formatDateCN(current),
        isToday: startOfWeek(today).getTime() === current.getTime(),
      })
    }

    return { columns: columns.length > 0 ? columns : [createFallbackColumn(today)], rangeStart: start, rangeEnd: end }
  }

  const start = startOfMonth(minDate)
  const end = startOfMonth(maxDate)
  const columns: TimelineColumn[] = []

  for (let current = new Date(start); current <= end; current = addMonths(current, 1)) {
    columns.push({
      key: current.toISOString(),
      date: new Date(current),
      label: current.getMonth() + 1 + '月',
      subLabel: current.getFullYear() + '年',
      isToday: startOfMonth(today).getTime() === current.getTime(),
    })
  }

  return { columns: columns.length > 0 ? columns : [createFallbackColumn(today)], rangeStart: start, rangeEnd: end }
}

function createFallbackColumn(date: Date): TimelineColumn {
  return {
    key: date.toISOString(),
    date,
    label: date.getMonth() + 1 + '月' + date.getDate() + '日',
    subLabel: weekdayName(date),
    isToday: isToday(date),
    isWeekend: isWeekend(date),
    showLabel: true,
  }
}

function getTaskSpan(task: GanttTask, rangeStart: Date, zoom: GanttZoom, totalColumns: number): { startIndex: number; width: number } {
  let startIndex = 0
  let endIndex = 0

  if (zoom === 'day') {
    startIndex = diffDays(rangeStart, task.startDate)
    endIndex = diffDays(rangeStart, task.endDate)
  } else if (zoom === 'week') {
    startIndex = Math.floor(diffDays(rangeStart, task.startDate) / 7)
    endIndex = Math.floor(diffDays(rangeStart, task.endDate) / 7)
  } else {
    const start = startOfMonth(rangeStart)
    const taskStart = startOfMonth(task.startDate)
    const taskEnd = startOfMonth(task.endDate)
    startIndex = (taskStart.getFullYear() - start.getFullYear()) * 12 + (taskStart.getMonth() - start.getMonth())
    endIndex = (taskEnd.getFullYear() - start.getFullYear()) * 12 + (taskEnd.getMonth() - start.getMonth())
  }

  const safeStart = Math.max(0, Math.min(totalColumns - 1, startIndex))
  const safeEnd = Math.max(safeStart, Math.min(totalColumns - 1, endIndex))

  return {
    startIndex: safeStart,
    width: Math.max(1, safeEnd - safeStart + 1),
  }
}

function isTaskVisibleInWindow(task: GanttTask, windowStart: Date, windowEnd: Date): boolean {
  const taskStart = new Date(task.startDate)
  const taskEnd = new Date(task.endDate)
  return taskStart <= windowEnd && taskEnd >= windowStart
}

function getPhaseColor(phaseId: number): { fill: string; light: string; border: string } {
  if (phaseId === 1) return { fill: '#EF4444', light: '#FEF2F2', border: '#FCA5A5' }
  if (phaseId === 2) return { fill: '#2563EB', light: '#EFF6FF', border: '#93C5FD' }
  return { fill: '#16A34A', light: '#F0FDF4', border: '#6EE7B7' }
}

function weekdayName(date: Date): string {
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return names[date.getDay() === 0 ? 6 : date.getDay() - 1]
}

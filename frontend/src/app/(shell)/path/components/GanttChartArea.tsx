'use client'

import type { GanttTask, GanttZoom, GanttMilestone } from '../hooks/gantt'

interface GanttChartAreaProps {
  tasks: GanttTask[]
  milestones: GanttMilestone[]
  zoom: GanttZoom
  selectedTaskId: string | null
  hoveredTaskId: string | null
  onTaskSelect: (taskId: string | null) => void
  onTaskHover: (taskId: string | null) => void
  onProgressChange?: (taskId: string, progress: number) => void
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void
}

export function GanttChartArea({ tasks }: GanttChartAreaProps) {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-4 text-sm text-[#6B7280]">
      当前甘特图数据已加载，共 {tasks.length} 个任务。
    </div>
  )
}

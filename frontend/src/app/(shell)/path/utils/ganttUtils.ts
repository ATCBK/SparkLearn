// 甘特图工具函数

import type { GanttTask, GanttTaskStatus, GanttPhase, GanttPlan, GanttMilestone, GanttZoom, DateRange } from '../hooks/gantt'
import type { EditablePhase, EditablePathNode } from '@/lib/api/types'
import { addDays, diffDays, endOfMonth, startOfMonth, startOfWeek, formatDate, isDateInRange } from './dateUtils'

export const PHASE_COLORS: Record<string, { bg: string; fill: string; border: string; light: string }> = {
  补基础: { bg: '#FEE2E2', fill: '#EF4444', border: '#FCA5A5', light: '#FEF2F2' },
  达标: { bg: '#DBEAFE', fill: '#2563EB', border: '#93C5FD', light: '#EFF6FF' },
  目标: { bg: '#D1FAE5', fill: '#16A34A', border: '#6EE7B7', light: '#F0FDF4' },
}

export const PHASE_NAMES: Record<number, string> = {
  1: '补基础',
  2: '达标',
  3: '目标',
}

export const PHASE_COLORS_BY_ID = ['#EF4444', '#2563EB', '#16A34A'] as const

export const STATUS_TEXT: Record<GanttTaskStatus, string> = {
  pending: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  blocked: '已阻塞',
}

export const STATUS_COLORS: Record<GanttTaskStatus, string> = {
  pending: '#9CA3AF',
  in_progress: '#2563EB',
  completed: '#16A34A',
  blocked: '#EF4444',
}

const DEFAULT_DAILY_HOURS = 2
const DEFAULT_TASK_DURATION = 3

export function generateGanttPlan(
  phases: EditablePhase[],
  startDate: Date = new Date(),
  dailyHours: number = DEFAULT_DAILY_HOURS,
): GanttPlan {
  let currentDate = new Date(startDate)
  const ganttPhases: GanttPhase[] = []
  let nodeIndex = 1

  phases.forEach((phase) => {
    const phaseName = PHASE_NAMES[phase.id] || '目标'
    const tasks: GanttTask[] = []

    phase.nodes.forEach((node) => {
      const duration = estimateTaskDuration(node, dailyHours)
      const endDate = addDays(currentDate, duration)

      tasks.push({
        id: `task-${node.id}`,
        nodeId: node.id,
        title: node.title,
        phase: phaseName as GanttTask['phase'],
        phaseId: phase.id,
        startDate: formatDate(currentDate),
        endDate: formatDate(endDate),
        duration,
        progress: nodeIndex === 1 ? 25 : 0,
        status: nodeIndex === 1 ? 'in_progress' : 'pending',
        estimatedHours: duration * dailyHours,
        difficulty: estimateDifficulty(node.title),
        priority: nodeIndex <= 3 ? 'high' : 'medium',
        dependencies: [],
        isCriticalPath: phase.id === 2,
        nodeIndex,
      })

      currentDate = addDays(endDate, 1)
      nodeIndex += 1
    })

    ganttPhases.push({
      id: phase.id,
      title: phase.title,
      color: PHASE_COLORS_BY_ID[phase.id - 1] || '#94A3B8',
      tasks,
    })
  })

  const allTasks = ganttPhases.flatMap((p) => p.tasks)
  const firstTask = allTasks[0]
  const lastTask = allTasks[allTasks.length - 1]
  const totalStart = firstTask ? new Date(firstTask.startDate) : new Date(startDate)
  const totalEnd = lastTask ? new Date(lastTask.endDate) : new Date(startDate)
  const totalDays = Math.max(1, diffDays(totalStart, totalEnd) + 1)

  return {
    planId: `plan-${Date.now()}`,
    target: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalDays,
    dailyHours,
    phases: ganttPhases,
    milestones: generateMilestones(ganttPhases),
  }
}

function estimateTaskDuration(node: EditablePathNode, dailyHours: number): number {
  const title = node.title.toLowerCase()

  if (title.includes('练习') || title.includes('题')) return Math.ceil(2 / dailyHours)
  if (title.includes('项目') || title.includes('实战')) return Math.ceil(6 / dailyHours)
  if (title.includes('复习') || title.includes('回顾')) return Math.ceil(1 / dailyHours)
  if (title.includes('学习') || title.includes('掌握')) return Math.ceil(3 / dailyHours)

  return DEFAULT_TASK_DURATION
}

function estimateDifficulty(title: string): 1 | 2 | 3 | 4 | 5 {
  const lower = title.toLowerCase()

  if (lower.includes('基础') || lower.includes('入门')) return 1
  if (lower.includes('练习') || lower.includes('回顾')) return 2
  if (lower.includes('理解') || lower.includes('掌握')) return 3
  if (lower.includes('应用') || lower.includes('综合')) return 4
  if (lower.includes('项目') || lower.includes('实战')) return 5

  return 3
}

function generateMilestones(phases: GanttPhase[]): GanttMilestone[] {
  return phases
    .filter((phase) => phase.tasks.length > 0)
    .map((phase) => {
      const lastTask = phase.tasks[phase.tasks.length - 1]
      return {
        id: `milestone-phase-${phase.id}`,
        title: `${phase.title}完成`,
        date: lastTask.endDate,
        type: 'checkpoint',
        relatedTaskIds: phase.tasks.map((t) => t.id),
      } satisfies GanttMilestone
    })
}

export function getTimelineRange(zoom: GanttZoom, referenceDate: Date = new Date()): DateRange {
  switch (zoom) {
    case 'day':
      return {
        start: addDays(referenceDate, -15),
        end: addDays(referenceDate, 15),
      }
    case 'week':
      return {
        start: addDays(startOfWeek(referenceDate), -7 * 4),
        end: addDays(startOfWeek(referenceDate), 7 * 4),
      }
    case 'month':
      return {
        start: startOfMonth(addDays(referenceDate, -90)),
        end: endOfMonth(addDays(referenceDate, 90)),
      }
  }
}

export function dateToX(date: Date | string, startDate: Date, cellWidth: number, zoom: GanttZoom): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = diffDays(startDate, d)

  switch (zoom) {
    case 'day':
      return diff * cellWidth
    case 'week':
      return (diff / 7) * cellWidth
    case 'month':
      return (diff / 30) * cellWidth
  }
}

export function getTaskBarWidth(startDate: string, endDate: string, cellWidth: number, zoom: GanttZoom): number {
  const days = Math.max(1, diffDays(startDate, endDate) + 1)

  switch (zoom) {
    case 'day':
      return Math.max(days * cellWidth, cellWidth)
    case 'week':
      return Math.max((days / 7) * cellWidth, cellWidth / 2)
    case 'month':
      return Math.max((days / 30) * cellWidth, cellWidth / 4)
  }
}

export function updateTaskProgress(plan: GanttPlan, taskId: string, progress: number): GanttPlan {
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => {
        if (task.id !== taskId) return task
        const nextProgress = Math.min(100, Math.max(0, progress))
        const nextStatus: GanttTaskStatus =
          nextProgress >= 100 ? 'completed' : nextProgress > 0 ? 'in_progress' : 'pending'
        return {
          ...task,
          progress: nextProgress,
          status: nextStatus,
          actualEndDate: nextProgress >= 100 ? new Date().toISOString() : undefined,
        }
      }),
    })),
    updatedAt: new Date().toISOString(),
  }
}

export function getTaskStats(phases: GanttPhase[]): { total: number; completed: number; inProgress: number } {
  const allTasks = phases.flatMap((p) => p.tasks)
  return {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.status === 'completed').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
  }
}

export function calculateOverallProgress(phases: GanttPhase[]): number {
  const allTasks = phases.flatMap((p) => p.tasks)
  if (allTasks.length === 0) return 0
  const totalProgress = allTasks.reduce((sum, task) => sum + task.progress, 0)
  return Math.round(totalProgress / allTasks.length)
}

export function isTaskInRange(task: GanttTask, start: Date, end: Date): boolean {
  return isDateInRange(new Date(task.startDate), start, end) || isDateInRange(new Date(task.endDate), start, end)
}

// ============ 甘特图工具函数 ============

import type { GanttTask, GanttTaskStatus, GanttPhase, GanttPlan, GanttMilestone, GanttZoom, DateRange } from '../hooks/gantt';
import type { EditablePhase, EditablePathNode } from '@/lib/api/types';
import { formatDate, addDays, diffDays, startOfMonth, endOfMonth, startOfWeek } from './dateUtils';

/** 阶段颜色映射 */
export const PHASE_COLORS: Record<string, { bg: string; fill: string; border: string; light: string }> = {
  '补弱': { bg: '#FEE2E2', fill: '#EF4444', border: '#FCA5A5', light: '#FEF2F2' },
  '达标': { bg: '#DBEAFE', fill: '#2563EB', border: '#93C5FD', light: '#EFF6FF' },
  '目标': { bg: '#D1FAE5', fill: '#16A34A', border: '#6EE7B7', light: '#F0FDF4' },
};

/** 阶段ID到名称映射 */
export const PHASE_NAMES: Record<number, string> = {
  1: '补弱',
  2: '达标',
  3: '目标',
};

/** 阶段颜色数组（按阶段ID） */
export const PHASE_COLORS_BY_ID = ['#EF4444', '#2563EB', '#16A34A'] as const;

/** 状态文本映射 */
export const STATUS_TEXT: Record<string, string> = {
  'pending': '未开始',
  'in_progress': '进行中',
  'completed': '已完成',
  'blocked': '已阻塞',
};

/** 状态颜色映射 */
export const STATUS_COLORS: Record<string, string> = {
  'pending': '#9CA3AF',
  'in_progress': '#2563EB',
  'completed': '#16A34A',
  'blocked': '#EF4444',
};

/** 默认每日学习时长（小时） */
const DEFAULT_DAILY_HOURS = 2;

/** 默认任务时长（天） */
const DEFAULT_TASK_DURATION = 3;

/**
 * 生成甘特图计划
 */
export function generateGanttPlan(
  phases: EditablePhase[],
  startDate: Date = new Date(),
  dailyHours: number = DEFAULT_DAILY_HOURS
): GanttPlan {
  let currentDate = new Date(startDate);
  const ganttPhases: GanttPhase[] = [];
  let nodeIndex = 1;

  phases.forEach((phase) => {
    const phaseName = PHASE_NAMES[phase.id] || '其他';
    const tasks: GanttTask[] = [];

    phase.nodes.forEach((node) => {
      // 根据节点复杂度估算时长
      const duration = estimateTaskDuration(node, dailyHours);
      const endDate = addDays(currentDate, duration);

      const task: GanttTask = {
        id: `task-${node.id}`,
        nodeId: node.id,
        title: node.title,
        phase: phaseName as '补弱' | '达标' | '目标',
        phaseId: phase.id,
        startDate: formatDate(currentDate),
        endDate: formatDate(endDate),
        duration,
        progress: nodeIndex === 1 ? 25 : 0, // 第一个节点默认进行中
        status: nodeIndex === 1 ? 'in_progress' : 'pending',
        estimatedHours: duration * dailyHours,
        difficulty: estimateDifficulty(node.title),
        priority: nodeIndex <= 3 ? 'high' : 'medium',
        dependencies: nodeIndex > 1 ? [`task-${phases[Math.floor((nodeIndex - 2) / 4)]?.nodes[(nodeIndex - 2) % 4]?.id || ''}`] : [],
        isCriticalPath: phase.id === 2, // 达标阶段为关键路径
        nodeIndex,
      };

      tasks.push(task);
      currentDate = addDays(endDate, 1); // 间隔1天
      nodeIndex++;
    });

    ganttPhases.push({
      id: phase.id,
      title: phase.title,
      color: PHASE_COLORS_BY_ID[phase.id - 1] || '#94A3B8',
      tasks,
    });
  });

  // 计算总天数
  const allTasks = ganttPhases.flatMap((p) => p.tasks);
  const totalStart = new Date(Math.min(...allTasks.map((t) => new Date(t.startDate).getTime())));
  const totalEnd = new Date(Math.max(...allTasks.map((t) => new Date(t.endDate).getTime())));
  const totalDays = diffDays(totalStart, totalEnd);

  // 生成里程碑
  const milestones = generateMilestones(ganttPhases);

  return {
    planId: `plan-${Date.now()}`,
    target: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalDays,
    dailyHours,
    phases: ganttPhases,
    milestones,
  };
}

/**
 * 估算任务时长
 */
function estimateTaskDuration(node: EditablePathNode, dailyHours: number): number {
  const title = node.title.toLowerCase();

  // 根据关键词估算
  if (title.includes('练习') || title.includes('题')) return Math.ceil(2 / dailyHours);
  if (title.includes('项目') || title.includes('实战')) return Math.ceil(6 / dailyHours);
  if (title.includes('复习') || title.includes('回顾')) return Math.ceil(1 / dailyHours);
  if (title.includes('学习') || title.includes('掌握')) return Math.ceil(3 / dailyHours);

  return DEFAULT_TASK_DURATION;
}

/**
 * 估算任务难度
 */
function estimateDifficulty(title: string): 1 | 2 | 3 | 4 | 5 {
  const lower = title.toLowerCase();

  if (lower.includes('基础') || lower.includes('入门')) return 1;
  if (lower.includes('练习') || lower.includes('回顾')) return 2;
  if (lower.includes('理解') || lower.includes('掌握')) return 3;
  if (lower.includes('应用') || lower.includes('综合')) return 4;
  if (lower.includes('项目') || lower.includes('实战')) return 5;

  return 3;
}

/**
 * 生成里程碑
 */
function generateMilestones(phases: GanttPhase[]): GanttMilestone[] {
  const milestones: GanttMilestone[] = [];

  // 每个阶段结束作为一个里程碑
  phases.forEach((phase) => {
    if (phase.tasks.length > 0) {
      const lastTask = phase.tasks[phase.tasks.length - 1];
      milestones.push({
        id: `milestone-phase-${phase.id}`,
        title: `${phase.title}完成`,
        date: lastTask.endDate,
        type: 'checkpoint',
        relatedTaskIds: phase.tasks.map((t) => t.id),
      });
    }
  });

  return milestones;
}

/**
 * 获取时间轴日期范围
 */
export function getTimelineRange(zoom: GanttZoom, referenceDate: Date = new Date()): DateRange {
  switch (zoom) {
    case 'day':
      // 显示前后15天
      return {
        start: addDays(referenceDate, -15),
        end: addDays(referenceDate, 15),
      };
    case 'week':
      // 显示前后8周
      return {
        start: addDays(startOfWeek(referenceDate), -7 * 4),
        end: addDays(startOfWeek(referenceDate), 7 * 4),
      };
    case 'month':
      // 显示前后3个月
      return {
        start: startOfMonth(addDays(referenceDate, -90)),
        end: endOfMonth(addDays(referenceDate, 90)),
      };
  }
}

/**
 * 计算日期在时间轴上的X坐标
 */
export function dateToX(
  date: Date | string,
  startDate: Date,
  cellWidth: number,
  zoom: GanttZoom
): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = diffDays(startDate, d);

  switch (zoom) {
    case 'day':
      return diff * cellWidth;
    case 'week':
      return (diff / 7) * cellWidth;
    case 'month':
      return (diff / 30) * cellWidth;
  }
}

/**
 * 计算任务条宽度
 */
export function getTaskBarWidth(
  startDate: string,
  endDate: string,
  cellWidth: number,
  zoom: GanttZoom
): number {
  const days = diffDays(startDate, endDate);

  switch (zoom) {
    case 'day':
      return Math.max(days * cellWidth, cellWidth);
    case 'week':
      return Math.max((days / 7) * cellWidth, cellWidth / 2);
    case 'month':
      return Math.max((days / 30) * cellWidth, cellWidth / 4);
  }
}

/**
 * 更新任务进度
 */
export function updateTaskProgress(
  plan: GanttPlan,
  taskId: string,
  progress: number
): GanttPlan {
  const newPhases = plan.phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks.map((task) => {
      if (task.id === taskId) {
        const newStatus = progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending';
        return {
          ...task,
          progress: Math.min(100, Math.max(0, progress)),
          status: newStatus as GanttTaskStatus,
          actualEndDate: progress >= 100 ? new Date().toISOString() : undefined,
        };
      }
      return task;
    }),
  }));

  return {
    ...plan,
    phases: newPhases,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 获取任务总数和完成数
 */
export function getTaskStats(phases: GanttPhase[]): { total: number; completed: number; inProgress: number } {
  const allTasks = phases.flatMap((p) => p.tasks);
  return {
    total: allTasks.length,
    completed: allTasks.filter((t) => t.status === 'completed').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
  };
}

/**
 * 计算总体进度
 */
export function calculateOverallProgress(phases: GanttPhase[]): number {
  const allTasks = phases.flatMap((p) => p.tasks);
  if (allTasks.length === 0) return 0;

  const totalProgress = allTasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / allTasks.length);
}

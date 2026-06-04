// ============ 甘特图数据管理 Hook（自动同步 phases） ============

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { GanttTask, GanttPlan, GanttZoom, GanttPhase } from './gantt';
import type { EditablePhase } from '@/lib/api/types';
import {
  generateGanttPlan,
  updateTaskProgress,
  getTaskStats,
  calculateOverallProgress,
} from '../utils/ganttUtils';
import { diffDays, formatDate } from '../utils/dateUtils';

interface UseGanttDataOptions {
  initialZoom?: GanttZoom;
  dailyHours?: number;
}

interface UseGanttDataReturn {
  /** 甘特图计划数据 */
  plan: GanttPlan | null;
  /** 更新整个计划 */
  updatePlan: (newPlan: GanttPlan) => void;
  /** 所有任务列表（扁平化） */
  allTasks: GanttTask[];
  /** 当前缩放级别 */
  zoom: GanttZoom;
  /** 设置缩放级别 */
  setZoom: (zoom: GanttZoom) => void;
  /** 选中的任务ID */
  selectedTaskId: string | null;
  /** 选中任务 */
  selectTask: (taskId: string | null) => void;
  /** 悬停的任务ID */
  hoveredTaskId: string | null;
  /** 设置悬停任务 */
  hoverTask: (taskId: string | null) => void;
  /** 更新任务进度 */
  updateProgress: (taskId: string, progress: number) => void;
  /** 更新任务日期 */
  updateTaskDate: (taskId: string, startDate: string, endDate: string) => void;
  /** 重新生成计划 */
  regenerate: (phases: EditablePhase[], startDate?: Date) => void;
  /** 任务统计 */
  stats: { total: number; completed: number; inProgress: number };
  /** 总体进度 */
  overallProgress: number;
  /** 是否已加载 */
  isLoaded: boolean;
  /** 获取指定任务 */
  getTask: (taskId: string) => GanttTask | undefined;
  /** 获取选中的任务 */
  selectedTask: GanttTask | null;
}

export function useGanttData(
  phases: EditablePhase[],
  options: UseGanttDataOptions = {}
): UseGanttDataReturn {
  const { initialZoom = 'week', dailyHours = 2 } = options;

  const [plan, setPlan] = useState<GanttPlan | null>(null);
  const [zoom, setZoom] = useState<GanttZoom>(initialZoom);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 记录上一次的 phases 长度，用于检测变化
  const prevPhasesRef = useRef<string>('');

  // 同步 phases 变化到甘特图
  useEffect(() => {
    if (phases.length === 0) return;

    // 计算 phases 的唯一标识（包括节点ID和顺序）
    const phasesKey = JSON.stringify(
      phases.map((p) => ({
        id: p.id,
        nodes: p.nodes.map((n) => n.id),
      }))
    );

    // 如果 phases 结构发生变化，重新生成甘特图
    if (phasesKey !== prevPhasesRef.current) {
      prevPhasesRef.current = phasesKey;

      if (!isLoaded) {
        // 首次加载，生成全新计划
        const newPlan = generateGanttPlan(phases, new Date(), dailyHours);
        setPlan(newPlan);
        setIsLoaded(true);

        // 默认选中第一个任务
        const firstTask = newPlan.phases[0]?.tasks[0];
        if (firstTask) {
          setSelectedTaskId(firstTask.id);
        }
      } else {
        // phases 变化，同步更新甘特图（保留已有任务的进度和日期）
        setPlan((prevPlan) => {
          if (!prevPlan) {
            return generateGanttPlan(phases, new Date(), dailyHours);
          }
          return syncPlanWithPhases(prevPlan, phases, dailyHours);
        });
      }
    }
  }, [phases, dailyHours, isLoaded]);

  // 扁平化所有任务
  const allTasks = useMemo(() => {
    if (!plan) return [];
    return plan.phases.flatMap((phase) => phase.tasks);
  }, [plan]);

  // 获取指定任务
  const getTask = useCallback(
    (taskId: string): GanttTask | undefined => {
      return allTasks.find((t) => t.id === taskId);
    },
    [allTasks]
  );

  // 选中的任务
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return getTask(selectedTaskId) || null;
  }, [selectedTaskId, getTask]);

  // 选中任务
  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  // 设置悬停任务
  const hoverTask = useCallback((taskId: string | null) => {
    setHoveredTaskId(taskId);
  }, []);

  // 更新任务进度
  const updateProgress = useCallback(
    (taskId: string, progress: number) => {
      if (!plan) return;
      const newPlan = updateTaskProgress(plan, taskId, progress);
      setPlan(newPlan);
    },
    [plan]
  );

  // 更新任务日期
  const updateTaskDate = useCallback(
    (taskId: string, startDate: string, endDate: string) => {
      if (!plan) return;
      const newPhases = plan.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((task) => {
          if (task.id === taskId) {
            const duration = diffDays(startDate, endDate);
            return { ...task, startDate, endDate, duration };
          }
          return task;
        }),
      }));
      setPlan({ ...plan, phases: newPhases, updatedAt: new Date().toISOString() });
    },
    [plan]
  );

  // 更新整个计划
  const updatePlan = useCallback((newPlan: GanttPlan) => {
    setPlan(newPlan);
  }, []);

  // 重新生成计划
  const regenerate = useCallback(
    (newPhases: EditablePhase[], startDate?: Date) => {
      const newPlan = generateGanttPlan(newPhases, startDate || new Date(), dailyHours);
      setPlan(newPlan);
      setSelectedTaskId(newPlan.phases[0]?.tasks[0]?.id || null);
      prevPhasesRef.current = JSON.stringify(
        newPhases.map((p) => ({
          id: p.id,
          nodes: p.nodes.map((n) => n.id),
        }))
      );
    },
    [dailyHours]
  );

  // 任务统计
  const stats = useMemo(() => {
    if (!plan) return { total: 0, completed: 0, inProgress: 0 };
    return getTaskStats(plan.phases);
  }, [plan]);

  // 总体进度
  const overallProgress = useMemo(() => {
    if (!plan) return 0;
    return calculateOverallProgress(plan.phases);
  }, [plan]);

  return {
    plan,
    updatePlan,
    allTasks,
    zoom,
    setZoom,
    selectedTaskId,
    selectTask,
    hoveredTaskId,
    hoverTask,
    updateProgress,
    updateTaskDate,
    regenerate,
    stats,
    overallProgress,
    isLoaded,
    getTask,
    selectedTask,
  };
}

/**
 * 同步甘特图计划与最新的 phases（保留已有任务的进度和日期）
 */
function syncPlanWithPhases(
  prevPlan: GanttPlan,
  phases: EditablePhase[],
  dailyHours: number
): GanttPlan {
  // 建立旧任务的映射（按 nodeId）
  const oldTaskMap = new Map<string, GanttTask>();
  prevPlan.phases.forEach((phase) => {
    phase.tasks.forEach((task) => {
      oldTaskMap.set(task.nodeId, task);
    });
  });

  // 获取最后一个任务的结束日期，用于新任务的排期
  const allOldTasks = prevPlan.phases.flatMap((p) => p.tasks);
  const lastEndDate =
    allOldTasks.length > 0
      ? new Date(Math.max(...allOldTasks.map((t) => new Date(t.endDate).getTime())))
      : new Date();

  let nodeIndex = 1;
  let nextStartDate = new Date(lastEndDate);
  nextStartDate.setDate(nextStartDate.getDate() + 1); // 间隔1天

  const PHASE_NAMES: Record<number, string> = { 1: '补弱', 2: '达标', 3: '目标' };
  const PHASE_COLORS = ['#EF4444', '#2563EB', '#16A34A'];

  const newPhases: GanttPhase[] = phases.map((phase) => {
    const phaseName = PHASE_NAMES[phase.id] || '其他';
    const tasks: GanttTask[] = [];

    phase.nodes.forEach((node) => {
      const existingTask = oldTaskMap.get(node.id);

      if (existingTask) {
        // 已有任务，保留进度和日期
        tasks.push({
          ...existingTask,
          nodeIndex,
        });
      } else {
        // 新任务，分配时间
        const duration = estimateTaskDuration(node.title, dailyHours);
        const endDate = new Date(nextStartDate);
        endDate.setDate(endDate.getDate() + duration);

        tasks.push({
          id: `task-${node.id}`,
          nodeId: node.id,
          title: node.title,
          phase: phaseName as '补弱' | '达标' | '目标',
          phaseId: phase.id,
          startDate: formatDate(nextStartDate),
          endDate: formatDate(endDate),
          duration,
          progress: 0,
          status: 'pending',
          estimatedHours: duration * dailyHours,
          difficulty: estimateDifficulty(node.title),
          priority: 'medium',
          dependencies: [],
          isCriticalPath: phase.id === 2,
          nodeIndex,
        });

        nextStartDate = new Date(endDate);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
      }

      nodeIndex++;
    });

    return {
      id: phase.id,
      title: phase.title,
      color: PHASE_COLORS[phase.id - 1] || '#94A3B8',
      tasks,
    };
  });

  // 计算总天数
  const allTasks = newPhases.flatMap((p) => p.tasks);
  const totalStart = new Date(Math.min(...allTasks.map((t) => new Date(t.startDate).getTime())));
  const totalEnd = new Date(Math.max(...allTasks.map((t) => new Date(t.endDate).getTime())));

  return {
    ...prevPlan,
    phases: newPhases,
    totalDays: diffDays(totalStart, totalEnd),
    updatedAt: new Date().toISOString(),
  };
}

/** 估算任务时长 */
function estimateTaskDuration(title: string, dailyHours: number): number {
  const lower = title.toLowerCase();
  if (lower.includes('练习') || lower.includes('题')) return Math.ceil(2 / dailyHours);
  if (lower.includes('项目') || lower.includes('实战')) return Math.ceil(6 / dailyHours);
  if (lower.includes('复习') || lower.includes('回顾')) return Math.ceil(1 / dailyHours);
  if (lower.includes('学习') || lower.includes('掌握')) return Math.ceil(3 / dailyHours);
  return 3;
}

/** 估算任务难度 */
function estimateDifficulty(title: string): 1 | 2 | 3 | 4 | 5 {
  const lower = title.toLowerCase();
  if (lower.includes('基础') || lower.includes('入门')) return 1;
  if (lower.includes('练习') || lower.includes('回顾')) return 2;
  if (lower.includes('理解') || lower.includes('掌握')) return 3;
  if (lower.includes('应用') || lower.includes('综合')) return 4;
  if (lower.includes('项目') || lower.includes('实战')) return 5;
  return 3;
}

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { EditablePhase } from '@/lib/api/types';
import type { GanttPlan, GanttTask, GanttZoom } from './gantt';
import {
  calculateOverallProgress,
  generateGanttPlan,
  getTaskStats,
  updateTaskProgress,
} from '../utils/ganttUtils';
import { diffDays, formatDate } from '../utils/dateUtils';

interface UseGanttDataOptions {
  initialZoom?: GanttZoom;
  dailyHours?: number;
}

export function useGanttData(phases: EditablePhase[], options: UseGanttDataOptions = {}) {
  const { initialZoom = 'week', dailyHours = 2 } = options;
  const [plan, setPlan] = useState<GanttPlan | null>(null);
  const [zoom, setZoom] = useState<GanttZoom>(initialZoom);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const prevPhasesRef = useRef('');

  useEffect(() => {
    if (!phases.length) return;
    const phasesKey = JSON.stringify(phases.map((p) => ({ id: p.id, nodes: p.nodes.map((n) => n.id) })));

    if (phasesKey !== prevPhasesRef.current) {
      prevPhasesRef.current = phasesKey;
      const newPlan = isLoaded
        ? syncPlanWithPhases(plan, phases, dailyHours)
        : generateGanttPlan(phases, new Date(), dailyHours);
      setPlan(newPlan);
      setIsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, dailyHours]);

  const allTasks = useMemo(() => plan?.phases.flatMap((phase) => phase.tasks) || [], [plan]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return allTasks.find((t) => t.id === selectedTaskId) || null;
  }, [allTasks, selectedTaskId]);

  const getTask = useCallback((taskId: string) => allTasks.find((t) => t.id === taskId), [allTasks]);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  const hoverTask = useCallback((taskId: string | null) => {
    setHoveredTaskId(taskId);
  }, []);

  const updateProgress = useCallback(
    (taskId: string, progress: number) => {
      if (!plan) return;
      setPlan(updateTaskProgress(plan, taskId, progress));
    },
    [plan],
  );

  const updateTaskDate = useCallback(
    (taskId: string, startDate: string, endDate: string) => {
      if (!plan) return;
      const phasesNext = plan.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((task) =>
          task.id === taskId
            ? { ...task, startDate, endDate, duration: diffDays(startDate, endDate) }
            : task,
        ),
      }));
      setPlan({ ...plan, phases: phasesNext, updatedAt: new Date().toISOString() });
    },
    [plan],
  );

  const regenerate = useCallback(
    (newPhases: EditablePhase[], startDate?: Date) => {
      const newPlan = generateGanttPlan(newPhases, startDate || new Date(), dailyHours);
      setPlan(newPlan);
      prevPhasesRef.current = JSON.stringify(newPhases.map((p) => ({ id: p.id, nodes: p.nodes.map((n) => n.id) })));
    },
    [dailyHours],
  );

  return {
    plan,
    updatePlan: setPlan,
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
    stats: plan ? getTaskStats(plan.phases) : { total: 0, completed: 0, inProgress: 0 },
    overallProgress: plan ? calculateOverallProgress(plan.phases) : 0,
    isLoaded,
    getTask,
    selectedTask,
  };
}

function syncPlanWithPhases(
  prevPlan: GanttPlan | null,
  phases: EditablePhase[],
  dailyHours: number,
): GanttPlan {
  if (!prevPlan) return generateGanttPlan(phases, new Date(), dailyHours);
  return generateGanttPlan(phases, new Date(), dailyHours);
}

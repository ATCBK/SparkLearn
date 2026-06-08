'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditablePhase } from '@/lib/api/types';
import type { GanttTask, GanttZoom } from '../hooks/gantt';
import { GanttTimeline } from './GanttTimeline';
import { GanttTodayLine } from './GanttTodayLine';
import { PHASE_COLORS_BY_ID, dateToX, getTaskBarWidth } from '../utils/ganttUtils';
import { addDays, startOfMonth, formatDateCN } from '../utils/dateUtils';

interface GanttContainerProps {
  phases: EditablePhase[];
  tasks: GanttTask[];
  zoom: GanttZoom;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
  onTaskHover: (taskId: string | null) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
  onTaskComplete?: (taskId: string, completed: boolean) => void;
}

const ROW_HEIGHT = 36;
const LEFT_COL_MIN = 176;
const LEFT_COL_MAX = 220;

export function GanttContainer({
  phases,
  tasks,
  zoom,
  selectedTaskId,
  hoveredTaskId,
  onTaskSelect,
  onTaskHover,
}: GanttContainerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [shellWidth, setShellWidth] = useState(0);

  useEffect(() => {
    if (!shellRef.current) return;

    const el = shellRef.current;
    const update = () => setShellWidth(el.clientWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { start: startDate, end: endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (zoom) {
      case 'day':
        return { start: addDays(today, -15), end: addDays(today, 30) };
      case 'week':
        return { start: addDays(today, -30), end: addDays(today, 60) };
      case 'month':
        return { start: startOfMonth(addDays(today, -60)), end: startOfMonth(addDays(today, 120)) };
    }
  }, [zoom]);

  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);

    while (cur <= endDate) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    return dates;
  }, [startDate, endDate]);

  const leftColWidth = shellWidth > 0 ? Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, Math.floor(shellWidth * 0.18))) : LEFT_COL_MAX;
  const timelineWidth = Math.max(shellWidth - leftColWidth, 1);
  const cellWidth = Math.max(8, timelineWidth / Math.max(timelineDates.length, 1));
  const totalWidth = leftColWidth + timelineWidth;

  const rows = useMemo(() => {
    const result: Array<
      | { type: 'phase-header'; phaseId: number; phaseTitle: string; phaseColor: string }
      | { type: 'task'; task: GanttTask | undefined; nodeTitle: string; nodeIndex: number; nodeId: string; isCompleted: boolean; phaseColor: string }
    > = [];

    let nodeIndex = 1;
    phases.forEach((phase) => {
      const phaseColor = PHASE_COLORS_BY_ID[phase.id - 1] || '#94A3B8';
      result.push({ type: 'phase-header', phaseId: phase.id, phaseTitle: phase.title, phaseColor });

      phase.nodes.forEach((node) => {
        const task = tasks.find((t) => t.nodeId === node.id);
        result.push({
          type: 'task',
          task,
          nodeTitle: node.title,
          nodeIndex,
          nodeId: node.id,
          isCompleted: task?.status === 'completed',
          phaseColor,
        });
        nodeIndex += 1;
      });
    });

    return result;
  }, [phases, tasks]);

  const totalHeight = rows.length * ROW_HEIGHT + 24;

  const phaseProgress = useMemo(() => {
    return phases.map((phase) => {
      const phaseTasks = phase.nodes.map((n) => tasks.find((t) => t.nodeId === n.id)).filter(Boolean) as GanttTask[];
      if (!phaseTasks.length) return 0;
      const completedCount = phaseTasks.filter((t) => t.status === 'completed').length;
      return Math.round((completedCount / phaseTasks.length) * 100);
    });
  }, [phases, tasks]);

  return (
    <div ref={shellRef} className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between border-b border-[#E5EAF2] bg-white px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-[8px] border border-[#E5EAF2] bg-white px-2.5 py-1 text-[11px] font-bold text-[#111827]">
            今天
          </span>
          <span className="text-xs font-bold text-[#111827]">
            {formatDateCN(startDate)} - {formatDateCN(endDate)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
          <span>
            共<span className="font-bold text-[#111827]">{tasks.length}</span> 个任务
          </span>
          <span>
            已完成<span className="font-bold text-[#16A34A]">{tasks.filter((t) => t.status === 'completed').length}</span>
          </span>
          <span>
            进行中<span className="font-bold text-[#2563EB]">{tasks.filter((t) => t.status === 'in_progress').length}</span>
          </span>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="relative" style={{ width: `${totalWidth}px`, minHeight: `${totalHeight}px` }}>
          <div className="sticky top-0 z-20 flex border-b border-[#E5EAF2] bg-white">
            <div className="flex-shrink-0 border-r border-[#E5EAF2]" style={{ width: `${leftColWidth}px` }} />
            <div className="flex-1" style={{ width: `${timelineWidth}px` }}>
              <GanttTimeline startDate={startDate} endDate={endDate} zoom={zoom} cellWidth={cellWidth} />
            </div>
          </div>

          <div className="relative">
            <GanttTodayLine startDate={startDate} cellWidth={cellWidth} totalHeight={totalHeight} offsetLeft={leftColWidth} />

            {rows.map((row, rowIndex) => {
              if (row.type === 'phase-header') {
                return (
                  <div
                    key={`phase-${row.phaseId}`}
                    className="sticky left-0 z-10 flex h-9 items-center border-b border-[#E5EAF2] bg-[#F9FAFB]"
                    style={{ top: 0 }}
                  >
                    <div
                      className="flex flex-shrink-0 items-center gap-2 border-r border-[#E5EAF2] px-3"
                      style={{ width: `${leftColWidth}px` }}
                    >
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.phaseColor }} />
                      <span className="truncate text-[11px] font-bold text-[#111827]">{row.phaseTitle}</span>
                      <span className="text-[10px] text-[#6B7280]">{phaseProgress[row.phaseId - 1]}%</span>
                    </div>
                    <div className="flex-1" />
                  </div>
                );
              }

              const task = row.task;
              const left = task ? dateToX(task.startDate, startDate, cellWidth, 'day') : 0;
              const width = task ? getTaskBarWidth(task.startDate, task.endDate, cellWidth, 'day') : cellWidth;

              return (
                <div key={row.nodeId || rowIndex} className="flex h-9 border-b border-[#F3F4F6]">
                  <div
                    className={`flex flex-shrink-0 items-center gap-2 border-r border-[#E5EAF2] px-3 transition-colors ${
                      selectedTaskId === task?.id
                        ? 'bg-[#F0F7FF]'
                        : hoveredTaskId === task?.id
                          ? 'bg-[#FAFBFC]'
                          : 'bg-white'
                    }`}
                    style={{ width: `${leftColWidth}px` }}
                    onClick={() => task && onTaskSelect(task.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[11px] font-bold leading-4 ${
                          row.isCompleted ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'
                        }`}
                      >
                        {row.nodeTitle}
                      </div>
                      {task && (
                        <div className="mt-0.5 text-[9px] text-[#9CA3AF]">
                          {formatDateCN(task.startDate)} → {formatDateCN(task.endDate)}
                        </div>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[9px] text-[#9CA3AF]">{row.nodeIndex}</span>
                  </div>

                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-0">
                      {Array.from({ length: timelineDates.length }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-[#F3F4F6]"
                          style={{ left: `${i * cellWidth}px` }}
                        />
                      ))}
                    </div>

                    {task && (
                      <div
                        className={`absolute top-1.5 h-6 cursor-pointer rounded-[6px] ${
                          selectedTaskId === task.id ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
                        }`}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                          backgroundColor: task.status === 'completed' ? '#D1FAE5' : `${row.phaseColor}15`,
                          borderLeft: `3px solid ${row.phaseColor}`,
                        }}
                        onClick={() => onTaskSelect(task.id)}
                        onMouseEnter={() => onTaskHover(task.id)}
                        onMouseLeave={() => onTaskHover(null)}
                      >
                        <div className="absolute inset-0 flex items-center px-2 text-[11px] font-bold text-[#111827]">
                          {task.progress}%
                        </div>
                        {task.status === 'completed' && (
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-[#16A34A]">✓</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

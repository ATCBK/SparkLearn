'use client';

// ============ 甘特图统一容器（左右同步滚动） ============

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { GanttTask, GanttZoom, GanttMilestone } from '../hooks/gantt';
import type { EditablePhase } from '@/lib/api/types';
import { GanttTimeline } from './GanttTimeline';
import { GanttTaskRow } from './GanttTaskRow';
import { GanttTodayLine } from './GanttTodayLine';
import { PHASE_COLORS_BY_ID } from '../utils/ganttUtils';
import { addDays, startOfMonth, formatDateCN, diffDays } from '../utils/dateUtils';

interface GanttContainerProps {
  phases: EditablePhase[];
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  zoom: GanttZoom;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
  onTaskHover: (taskId: string | null) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
  onTaskComplete?: (taskId: string, completed: boolean) => void;
}

/** 单元格宽度配置 */
const CELL_WIDTHS: Record<GanttZoom, number> = {
  day: 40,
  week: 120,
  month: 200,
};

/** 行高 */
const ROW_HEIGHT = 52;

export function GanttContainer({
  phases,
  tasks,
  milestones,
  zoom,
  selectedTaskId,
  hoveredTaskId,
  onTaskSelect,
  onTaskHover,
  onProgressChange,
  onDateChange,
  onTaskComplete,
}: GanttContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  // 单元格宽度
  const cellWidth = CELL_WIDTHS[zoom];

  // 计算时间范围
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

  // 计算总宽度
  const totalWidth = useMemo(() => {
    const days = diffDays(startDate, endDate);
    switch (zoom) {
      case 'day': return days * cellWidth;
      case 'week': return (days / 7) * cellWidth;
      case 'month': return (days / 30) * cellWidth;
    }
  }, [startDate, endDate, zoom, cellWidth]);

  // 构建行数据（节点 + 阶段标题）
  const rows = useMemo(() => {
    const result: Array<{
      type: 'phase-header' | 'task';
      phaseId?: number;
      phaseTitle?: string;
      phaseColor?: string;
      task?: GanttTask;
      nodeTitle?: string;
      nodeIndex?: number;
      nodeId?: string;
      isCompleted?: boolean;
    }> = [];

    let nodeIndex = 1;
    phases.forEach((phase) => {
      const phaseColor = PHASE_COLORS_BY_ID[phase.id - 1] || '#94A3B8';

      // 阶段标题行
      result.push({
        type: 'phase-header',
        phaseId: phase.id,
        phaseTitle: phase.title,
        phaseColor,
      });

      // 任务行
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
        nodeIndex++;
      });
    });

    return result;
  }, [phases, tasks]);

  // 总高度
  const totalHeight = rows.length * ROW_HEIGHT + 40; // 40 给里程碑

  // 滚动到今天
  const scrollToToday = useCallback(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const today = new Date();
    const daysFromStart = diffDays(startDate, today);
    let scrollTo: number;

    switch (zoom) {
      case 'day': scrollTo = daysFromStart * cellWidth; break;
      case 'week': scrollTo = (daysFromStart / 7) * cellWidth; break;
      case 'month': scrollTo = (daysFromStart / 30) * cellWidth; break;
    }

    scrollContainer.scrollTo({
      left: Math.max(0, scrollTo - scrollContainer.clientWidth / 3),
      behavior: 'smooth',
    });
  }, [startDate, zoom, cellWidth]);

  // 初始化滚动到今天
  useEffect(() => {
    scrollToToday();
  }, [scrollToToday, zoom]);

  // 计算每个阶段的完成进度
  const phaseProgress = useMemo(() => {
    return phases.map((phase) => {
      const phaseTasks = phase.nodes
        .map((n) => tasks.find((t) => t.nodeId === n.id))
        .filter(Boolean) as GanttTask[];
      if (phaseTasks.length === 0) return 0;
      const completedCount = phaseTasks.filter((t) => t.status === 'completed').length;
      return Math.round((completedCount / phaseTasks.length) * 100);
    });
  }, [phases, tasks]);

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5EAF2] bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={scrollToToday}
            className="rounded-[8px] border border-[#E5EAF2] bg-white px-3 py-1.5 text-xs font-bold text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >
            今天
          </button>
          <span className="text-sm font-bold text-[#111827]">
            {formatDateCN(startDate)} - {formatDateCN(endDate)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          <span>共 <span className="font-bold text-[#111827]">{tasks.length}</span> 个任务</span>
          <span>已完成 <span className="font-bold text-[#16A34A]">{tasks.filter((t) => t.status === 'completed').length}</span></span>
          <span>进行中 <span className="font-bold text-[#2563EB]">{tasks.filter((t) => t.status === 'in_progress').length}</span></span>
        </div>
      </div>

      {/* 主内容区（统一滚动） */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: `${totalWidth + 320}px`, minHeight: `${totalHeight}px` }}>
          {/* 时间轴头部（固定在顶部） */}
          <div className="sticky top-0 z-20 flex bg-white border-b border-[#E5EAF2]">
            {/* 左侧空白（对应节点列表宽度） */}
            <div className="w-[320px] flex-shrink-0 border-r border-[#E5EAF2]" />

            {/* 右侧时间轴 */}
            <div className="flex-1">
              <GanttTimeline
                startDate={startDate}
                endDate={endDate}
                zoom={zoom}
                cellWidth={cellWidth}
              />
            </div>
          </div>

          {/* 行内容 */}
          <div className="relative">
            {/* 今日线 */}
            <GanttTodayLine
              startDate={startDate}
              cellWidth={cellWidth}
              zoom={zoom}
              totalHeight={totalHeight}
              offsetLeft={320}
            />

            {/* 行 */}
            {rows.map((row, rowIndex) => {
              const y = rowIndex * ROW_HEIGHT;

              if (row.type === 'phase-header') {
                // 阶段标题行
                return (
                  <div
                    key={`phase-${row.phaseId}`}
                    className="sticky left-0 z-10 flex items-center h-[52px] bg-[#F9FAFB] border-b border-[#E5EAF2]"
                    style={{ top: 0 }}
                  >
                    <div className="w-[320px] flex-shrink-0 flex items-center gap-2 px-4 border-r border-[#E5EAF2]">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: row.phaseColor }}
                      />
                      <span className="text-sm font-bold text-[#111827]">{row.phaseTitle}</span>
                      <span className="text-xs text-[#6B7280]">
                        {phaseProgress[(row.phaseId || 1) - 1]}%
                      </span>
                    </div>
                    <div className="flex-1" />
                  </div>
                );
              }

              // 任务行
              return (
                <GanttTaskRow
                  key={row.nodeId || rowIndex}
                  task={row.task}
                  nodeTitle={row.nodeTitle || ''}
                  nodeIndex={row.nodeIndex || 0}
                  nodeId={row.nodeId || ''}
                  isCompleted={row.isCompleted || false}
                  phaseColor={row.phaseColor || '#94A3B8'}
                  startDate={startDate}
                  cellWidth={cellWidth}
                  zoom={zoom}
                  isSelected={selectedTaskId === row.task?.id}
                  isHovered={hoveredTaskId === row.task?.id}
                  onClick={() => {
                    if (row.task) onTaskSelect(row.task.id);
                  }}
                  onHover={(hovered) => {
                    if (row.task) onTaskHover(hovered ? row.task.id : null);
                  }}
                  onProgressChange={onProgressChange}
                  onDateChange={onDateChange}
                  onTaskComplete={onTaskComplete}
                  totalWidth={totalWidth}
                />
              );
            })}

            {/* 里程碑 */}
            {milestones.map((milestone) => {
              const daysFromStart = diffDays(startDate, milestone.date);
              let x: number;
              switch (zoom) {
                case 'day': x = daysFromStart * cellWidth; break;
                case 'week': x = (daysFromStart / 7) * cellWidth; break;
                case 'month': x = (daysFromStart / 30) * cellWidth; break;
              }

              return (
                <div
                  key={milestone.id}
                  className="absolute top-0"
                  style={{ left: `${x + 320}px` }}
                >
                  <div className="relative -left-2 -top-1">
                    <div className="w-4 h-4 bg-[#F59E0B] rotate-45 transform" />
                  </div>
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="rounded-[4px] bg-[#FEF3C7] px-1.5 py-0.5 text-[9px] font-bold text-[#92400E]">
                      {milestone.title}
                    </span>
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

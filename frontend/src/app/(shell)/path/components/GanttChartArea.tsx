'use client';

// ============ 甘特图区域组件 ============

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { GanttTask, GanttZoom, GanttMilestone } from '../hooks/gantt';
import { GanttTimeline } from './GanttTimeline';
import { GanttTaskBar } from './GanttTaskBar';
import { GanttTodayLine } from './GanttTodayLine';
import { PHASE_COLORS_BY_ID } from '../utils/ganttUtils';
import { addDays, addMonths, startOfMonth, formatDateCN, diffDays } from '../utils/dateUtils';

interface GanttChartAreaProps {
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  zoom: GanttZoom;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
  onTaskHover: (taskId: string | null) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
}

/** 单元格宽度配置 */
const CELL_WIDTHS: Record<GanttZoom, number> = {
  day: 40,
  week: 120,
  month: 200,
};

export function GanttChartArea({
  tasks,
  milestones,
  zoom,
  selectedTaskId,
  hoveredTaskId,
  onTaskSelect,
  onTaskHover,
  onProgressChange,
  onDateChange,
}: GanttChartAreaProps) {
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
        return {
          start: addDays(today, -15),
          end: addDays(today, 30),
        };
      case 'week':
        return {
          start: addDays(today, -30),
          end: addDays(today, 60),
        };
      case 'month':
        return {
          start: startOfMonth(addDays(today, -60)),
          end: startOfMonth(addDays(today, 120)),
        };
    }
  }, [zoom]);

  // 计算总宽度
  const totalWidth = useMemo(() => {
    const days = diffDays(startDate, endDate);
    switch (zoom) {
      case 'day':
        return days * cellWidth;
      case 'week':
        return (days / 7) * cellWidth;
      case 'month':
        return (days / 30) * cellWidth;
    }
  }, [startDate, endDate, zoom, cellWidth]);

  // 计算总高度
  const totalHeight = tasks.length * 52 + 40; // 40px 给里程碑

  // 滚动到今天
  const scrollToToday = useCallback(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const today = new Date();
    const daysFromStart = diffDays(startDate, today);
    let scrollTo: number;

    switch (zoom) {
      case 'day':
        scrollTo = daysFromStart * cellWidth - scrollContainer.clientWidth / 2;
        break;
      case 'week':
        scrollTo = (daysFromStart / 7) * cellWidth - scrollContainer.clientWidth / 2;
        break;
      case 'month':
        scrollTo = (daysFromStart / 30) * cellWidth - scrollContainer.clientWidth / 2;
        break;
    }

    scrollContainer.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
  }, [startDate, zoom, cellWidth]);

  // 初始化滚动到今天
  useEffect(() => {
    scrollToToday();
  }, [scrollToToday, zoom]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollLeft(scrollRef.current.scrollLeft);
    }
  }, []);

  // 获取任务行的Y坐标
  const getTaskY = useCallback(
    (taskId: string): number => {
      const idx = tasks.findIndex((t) => t.id === taskId);
      return idx >= 0 ? idx * 52 + 8 : 0;
    },
    [tasks]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5EAF2]">
        <div className="flex items-center gap-3">
          {/* 今日按钮 */}
          <button
            onClick={scrollToToday}
            className="rounded-[8px] border border-[#E5EAF2] bg-white px-3 py-1.5 text-xs font-bold text-[#111827] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
          >
            今天
          </button>

          {/* 日期显示 */}
          <span className="text-sm font-bold text-[#111827]">
            {formatDateCN(startDate)} - {formatDateCN(endDate)}
          </span>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          <span>
            共 <span className="font-bold text-[#111827]">{tasks.length}</span> 个任务
          </span>
          <span>
            已完成{' '}
            <span className="font-bold text-[#16A34A]">
              {tasks.filter((t) => t.status === 'completed').length}
            </span>
          </span>
          <span>
            进行中{' '}
            <span className="font-bold text-[#2563EB]">
              {tasks.filter((t) => t.status === 'in_progress').length}
            </span>
          </span>
        </div>
      </div>

      {/* 甘特图主体 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div
          className="relative"
          style={{ width: `${totalWidth}px`, minHeight: `${totalHeight}px` }}
        >
          {/* 时间轴 */}
          <GanttTimeline
            startDate={startDate}
            endDate={endDate}
            zoom={zoom}
            cellWidth={cellWidth}
          />

          {/* 网格背景 */}
          <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
            {/* 垂直网格线 */}
            {Array.from({ length: Math.ceil(totalWidth / cellWidth) }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-[#F3F4F6]"
                style={{ left: `${i * cellWidth}px` }}
              />
            ))}

            {/* 水平网格线（每行任务） */}
            {tasks.map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-px bg-[#F3F4F6]"
                style={{ top: `${i * 52 + 52}px` }}
              />
            ))}
          </div>

          {/* 今日线 */}
          <GanttTodayLine
            startDate={startDate}
            cellWidth={cellWidth}
            zoom={zoom}
            totalHeight={totalHeight}
          />

          {/* 里程碑标记 */}
          {milestones.map((milestone) => {
            const daysFromStart = diffDays(startDate, milestone.date);
            let x: number;

            switch (zoom) {
              case 'day':
                x = daysFromStart * cellWidth;
                break;
              case 'week':
                x = (daysFromStart / 7) * cellWidth;
                break;
              case 'month':
                x = (daysFromStart / 30) * cellWidth;
                break;
            }

            return (
              <div
                key={milestone.id}
                className="absolute top-0"
                style={{ left: `${x}px` }}
              >
                {/* 里程碑菱形 */}
                <div className="relative -left-2 -top-1">
                  <div className="w-4 h-4 bg-[#F59E0B] rotate-45 transform" />
                </div>
                {/* 里程碑标签 */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="rounded-[4px] bg-[#FEF3C7] px-1.5 py-0.5 text-[9px] font-bold text-[#92400E]">
                    {milestone.title}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 任务条 */}
          {tasks.map((task) => (
            <GanttTaskBar
              key={task.id}
              task={task}
              startDate={startDate}
              cellWidth={cellWidth}
              zoom={zoom}
              isSelected={selectedTaskId === task.id}
              isHovered={hoveredTaskId === task.id}
              onClick={() => onTaskSelect(task.id)}
              onHover={(hovered) => onTaskHover(hovered ? task.id : null)}
              onProgressChange={onProgressChange}
              onDateChange={onDateChange}
            />
          ))}

          {/* 依赖关系连线（简化版：只显示直接依赖） */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={totalWidth}
            height={totalHeight}
          >
            {tasks.map((task) =>
              task.dependencies.map((depId) => {
                const depTask = tasks.find((t) => t.id === depId);
                if (!depTask) return null;

                const fromIdx = tasks.indexOf(depTask);
                const toIdx = tasks.indexOf(task);

                const fromX = dateToX(depTask.endDate, startDate, cellWidth, zoom);
                const fromY = fromIdx * 52 + 32;
                const toX = dateToX(task.startDate, startDate, cellWidth, zoom);
                const toY = toIdx * 52 + 32;

                return (
                  <g key={`${depId}-${task.id}`}>
                    <path
                      d={`M ${fromX} ${fromY} C ${fromX + 20} ${fromY}, ${toX - 20} ${toY}, ${toX} ${toY}`}
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="1.5"
                      strokeDasharray="4"
                    />
                    <circle cx={toX} cy={toY} r="3" fill="#CBD5E1" />
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

/** 计算日期X坐标 */
function dateToX(
  date: Date | string,
  startDate: Date,
  cellWidth: number,
  zoom: GanttZoom
): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = diffDays(startDate, d);

  switch (zoom) {
    case 'day':
      return days * cellWidth;
    case 'week':
      return (days / 7) * cellWidth;
    case 'month':
      return (days / 30) * cellWidth;
  }
}

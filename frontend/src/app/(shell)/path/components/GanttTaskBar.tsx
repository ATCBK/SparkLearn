'use client';

// ============ 甘特图任务条组件（支持拖拽调整日期） ============

import { useState, useRef, useCallback, useMemo } from 'react';
import type { GanttTask, GanttZoom } from '../hooks/gantt';
import { PHASE_COLORS, STATUS_TEXT, STATUS_COLORS } from '../utils/ganttUtils';
import { dateToX, getTaskBarWidth } from '../utils/ganttUtils';
import { formatDateCN, diffDays, addDays, formatDate } from '../utils/dateUtils';

interface GanttTaskBarProps {
  task: GanttTask;
  startDate: Date;
  cellWidth: number;
  zoom: GanttZoom;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
}

export function GanttTaskBar({
  task,
  startDate,
  cellWidth,
  zoom,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onProgressChange,
  onDateChange,
}: GanttTaskBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'left' | 'right' | 'progress' | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // 计算任务条位置和宽度
  const { left, width } = useMemo(() => {
    const l = dateToX(task.startDate, startDate, cellWidth, zoom);
    const w = getTaskBarWidth(task.startDate, task.endDate, cellWidth, zoom);
    return { left: l, width: w };
  }, [task.startDate, task.endDate, startDate, cellWidth, zoom]);

  // 获取阶段颜色
  const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS['达标'];

  // 计算每天的像素宽度
  const dayWidth = useMemo(() => {
    const days = diffDays(task.startDate, task.endDate);
    return days > 0 ? width / days : cellWidth;
  }, [task.startDate, task.endDate, width, cellWidth]);

  // 拖拽左侧边缘调整开始日期
  const handleLeftEdgeDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDateChange) return;

      setIsDragging(true);
      setDragType('left');

      const startX = e.clientX;
      const originalStart = task.startDate;
      const originalEnd = task.endDate;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaDays = Math.round(deltaX / dayWidth);
        const newStart = addDays(originalStart, deltaDays);

        // 确保开始日期不超过结束日期
        if (newStart < new Date(originalEnd)) {
          onDateChange(task.id, formatDate(newStart), originalEnd);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setDragType(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [task.id, task.startDate, task.endDate, dayWidth, onDateChange]
  );

  // 拖拽右侧边缘调整结束日期
  const handleRightEdgeDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDateChange) return;

      setIsDragging(true);
      setDragType('right');

      const startX = e.clientX;
      const originalStart = task.startDate;
      const originalEnd = task.endDate;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaDays = Math.round(deltaX / dayWidth);
        const newEnd = addDays(originalEnd, deltaDays);

        // 确保结束日期不早于开始日期
        if (newEnd > new Date(originalStart)) {
          onDateChange(task.id, originalStart, formatDate(newEnd));
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setDragType(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [task.id, task.startDate, task.endDate, dayWidth, onDateChange]
  );

  // 进度拖拽处理
  const handleProgressDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onProgressChange) return;

      setIsDragging(true);
      setDragType('progress');

      const bar = barRef.current;
      if (!bar) return;

      const startX = e.clientX;
      const startProgress = task.progress;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaPercent = (deltaX / width) * 100;
        const newProgress = Math.min(100, Math.max(0, startProgress + deltaPercent));
        onProgressChange(task.id, Math.round(newProgress));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        setDragType(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [task.id, task.progress, width, onProgressChange]
  );

  return (
    <div
      className="relative h-[52px] flex items-center group"
      onMouseEnter={() => {
        onHover(true);
        setTooltipVisible(true);
      }}
      onMouseLeave={() => {
        onHover(false);
        setTooltipVisible(false);
      }}
    >
      {/* 任务条 */}
      <div
        ref={barRef}
        onClick={onClick}
        className={`absolute h-8 rounded-[6px] cursor-pointer transition-all ${
          isSelected ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
        } ${isHovered ? 'shadow-md' : 'shadow-sm'} ${isDragging ? 'opacity-80' : ''}`}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: task.status === 'completed' ? '#D1FAE5' : phaseColor.light,
          borderLeft: `3px solid ${phaseColor.fill}`,
        }}
      >
        {/* 左侧拖拽手柄（调整开始日期） */}
        {onDateChange && (
          <div
            className="absolute inset-y-0 left-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onMouseDown={handleLeftEdgeDrag}
            title="拖拽调整开始日期"
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#6B7280] rounded-r-full hover:bg-[#2563EB] transition-colors" />
          </div>
        )}

        {/* 进度填充 */}
        <div
          className="absolute inset-y-0 left-0 rounded-r-[4px] transition-all"
          style={{
            width: `${task.progress}%`,
            backgroundColor: phaseColor.fill,
            opacity: 0.25,
          }}
        />

        {/* 任务信息 */}
        <div className="absolute inset-0 flex items-center px-3 overflow-hidden pointer-events-none">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold text-[#111827] line-clamp-1 flex-1">
              {task.title}
            </span>
            {width > 80 && (
              <span className="text-[10px] text-[#6B7280] ml-2 flex-shrink-0">
                {task.progress}%
              </span>
            )}
          </div>
        </div>

        {/* 右侧拖拽手柄（调整结束日期） */}
        <div
          className="absolute inset-y-0 right-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={handleRightEdgeDrag}
          title="拖拽调整结束日期"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#6B7280] rounded-l-full hover:bg-[#2563EB] transition-colors" />
        </div>

        {/* 状态图标 */}
        {task.status === 'completed' && (
          <div className="absolute -right-2 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-[#16A34A] bg-white rounded-full" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* 关键路径标记 */}
        {task.isCriticalPath && (
          <div className="absolute -top-1 -right-1">
            <div className="w-3 h-3 bg-[#F59E0B] rounded-full border-2 border-white" />
          </div>
        )}
      </div>

      {/* Hover 提示 */}
      {tooltipVisible && !isDragging && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="rounded-[10px] border border-[#E5EAF2] bg-white p-3 shadow-lg min-w-[240px]">
            <div className="text-sm font-bold text-[#111827] mb-2">{task.title}</div>
            <div className="space-y-1.5 text-xs text-[#6B7280]">
              <div className="flex justify-between">
                <span>开始日期</span>
                <span className="font-medium text-[#111827]">{formatDateCN(task.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>结束日期</span>
                <span className="font-medium text-[#111827]">{formatDateCN(task.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>预计时长</span>
                <span className="font-medium text-[#111827]">{task.duration} 天</span>
              </div>
              <div className="flex justify-between">
                <span>学习进度</span>
                <span className="font-medium text-[#2563EB]">{task.progress}%</span>
              </div>
              <div className="flex justify-between">
                <span>状态</span>
                <span
                  className="font-medium"
                  style={{ color: STATUS_COLORS[task.status] }}
                >
                  {STATUS_TEXT[task.status]}
                </span>
              </div>
            </div>

            {/* 进度条 */}
            <div className="mt-3">
              <div className="h-1.5 bg-[#E5EAF2] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${task.progress}%`,
                    backgroundColor: phaseColor.fill,
                  }}
                />
              </div>
            </div>

            {/* 拖拽提示 */}
            <div className="mt-2 pt-2 border-t border-[#F3F4F6] text-[10px] text-[#9CA3AF] text-center">
              拖拽左右边缘可调整时间
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

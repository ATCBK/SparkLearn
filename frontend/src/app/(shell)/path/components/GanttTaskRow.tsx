'use client';

// ============ 甘特图任务行组件（左侧节点 + 右侧任务条） ============

import { useState, useRef, useCallback, useMemo } from 'react';
import type { GanttTask, GanttZoom } from '../hooks/gantt';
import { PHASE_COLORS, STATUS_TEXT, STATUS_COLORS } from '../utils/ganttUtils';
import { dateToX, getTaskBarWidth } from '../utils/ganttUtils';
import { formatDateCN, diffDays, addDays, formatDate } from '../utils/dateUtils';

interface GanttTaskRowProps {
  task?: GanttTask;
  nodeTitle: string;
  nodeIndex: number;
  nodeId: string;
  isCompleted: boolean;
  phaseColor: string;
  startDate: Date;
  cellWidth: number;
  zoom: GanttZoom;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
  onTaskComplete?: (taskId: string, completed: boolean) => void;
  totalWidth: number;
}

export function GanttTaskRow({
  task,
  nodeTitle,
  nodeIndex,
  nodeId,
  isCompleted,
  phaseColor,
  startDate,
  cellWidth,
  zoom,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onProgressChange,
  onDateChange,
  onTaskComplete,
  totalWidth,
}: GanttTaskRowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // 计算任务条位置和宽度
  const barStyle = useMemo(() => {
    if (!task) return null;
    const left = dateToX(task.startDate, startDate, cellWidth, zoom);
    const width = getTaskBarWidth(task.startDate, task.endDate, cellWidth, zoom);
    return { left, width };
  }, [task, startDate, cellWidth, zoom]);

  // 计算每天的像素宽度
  const dayWidth = useMemo(() => {
    if (!task || !barStyle) return cellWidth;
    const days = diffDays(task.startDate, task.endDate);
    return days > 0 ? barStyle.width / days : cellWidth;
  }, [task, barStyle, cellWidth]);

  // 拖拽左侧边缘调整开始日期
  const handleLeftEdgeDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDateChange || !task) return;

      setIsDragging(true);
      const startX = e.clientX;
      const originalStart = task.startDate;
      const originalEnd = task.endDate;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaDays = Math.round(deltaX / dayWidth);
        const newStart = addDays(originalStart, deltaDays);
        if (newStart < new Date(originalEnd)) {
          onDateChange(task.id, formatDate(newStart), originalEnd);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [task, dayWidth, onDateChange]
  );

  // 拖拽右侧边缘调整结束日期
  const handleRightEdgeDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDateChange || !task) return;

      setIsDragging(true);
      const startX = e.clientX;
      const originalStart = task.startDate;
      const originalEnd = task.endDate;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaDays = Math.round(deltaX / dayWidth);
        const newEnd = addDays(originalEnd, deltaDays);
        if (newEnd > new Date(originalStart)) {
          onDateChange(task.id, originalStart, formatDate(newEnd));
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [task, dayWidth, onDateChange]
  );

  // 处理完成状态切换
  const handleCompleteToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onTaskComplete && task) {
        onTaskComplete(task.id, !isCompleted);
      }
    },
    [task, isCompleted, onTaskComplete]
  );

  return (
    <div
      className="flex h-[52px] border-b border-[#F3F4F6] group"
      onMouseEnter={() => {
        onHover(true);
        setShowTooltip(true);
      }}
      onMouseLeave={() => {
        onHover(false);
        setShowTooltip(false);
      }}
    >
      {/* 左侧：节点信息（固定宽度 320px） */}
      <div
        className={`w-[320px] flex-shrink-0 flex items-center gap-3 px-4 border-r border-[#E5EAF2] cursor-pointer transition-colors ${
          isSelected ? 'bg-[#F0F7FF]' : isHovered ? 'bg-[#FAFBFC]' : 'bg-white'
        }`}
        onClick={onClick}
      >
        {/* 完成按钮 */}
        <button
          onClick={handleCompleteToggle}
          className="flex-shrink-0"
          title={isCompleted ? '标记为未完成' : '标记为已完成'}
        >
          {isCompleted ? (
            <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] hover:border-[#2563EB] transition-colors" />
          )}
        </button>

        {/* 节点信息 */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-bold leading-tight truncate ${
              isCompleted ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'
            }`}
          >
            {nodeTitle}
          </div>
          {task && (
            <div className="text-[10px] text-[#9CA3AF] mt-0.5">
              {formatDateCN(task.startDate)} → {formatDateCN(task.endDate)}
            </div>
          )}
        </div>

        {/* 序号 */}
        <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{nodeIndex}</span>
      </div>

      {/* 右侧：甘特图区域 */}
      <div className="flex-1 relative">
        {/* 网格背景 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 垂直网格线 */}
          {Array.from({ length: Math.ceil(totalWidth / cellWidth) }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-[#F3F4F6]"
              style={{ left: `${i * cellWidth}px` }}
            />
          ))}
        </div>

        {/* 任务条 */}
        {task && barStyle && (
          <div
            className={`absolute top-2 h-8 rounded-[6px] cursor-pointer transition-all ${
              isSelected ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
            } ${isHovered ? 'shadow-md' : 'shadow-sm'} ${isDragging ? 'opacity-80' : ''}`}
            style={{
              left: `${barStyle.left}px`,
              width: `${barStyle.width}px`,
              backgroundColor: isCompleted ? '#D1FAE5' : `${phaseColor}15`,
              borderLeft: `3px solid ${phaseColor}`,
            }}
            onClick={onClick}
          >
            {/* 左侧拖拽手柄 */}
            {onDateChange && (
              <div
                className="absolute inset-y-0 left-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onMouseDown={handleLeftEdgeDrag}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#6B7280] rounded-r-full hover:bg-[#2563EB] transition-colors" />
              </div>
            )}

            {/* 进度填充 */}
            {!isCompleted && (
              <div
                className="absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{
                  width: `${task.progress}%`,
                  backgroundColor: phaseColor,
                  opacity: 0.25,
                }}
              />
            )}

            {/* 任务信息 */}
            <div className="absolute inset-0 flex items-center px-3 overflow-hidden pointer-events-none">
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-bold line-clamp-1 flex-1 ${
                    isCompleted ? 'text-[#9CA3AF]' : 'text-[#111827]'
                  }`}
                >
                  {task.progress}%
                </span>
              </div>
            </div>

            {/* 右侧拖拽手柄 */}
            {onDateChange && (
              <div
                className="absolute inset-y-0 right-0 w-3 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onMouseDown={handleRightEdgeDrag}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#6B7280] rounded-l-full hover:bg-[#2563EB] transition-colors" />
              </div>
            )}

            {/* 完成图标 */}
            {isCompleted && (
              <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-[#16A34A] bg-white rounded-full" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Hover 提示 */}
        {showTooltip && task && !isDragging && (
          <div
            className="absolute bottom-full mb-2 z-50 pointer-events-none"
            style={{ left: `${(barStyle?.left || 0) + (barStyle?.width || 0) / 2}px`, transform: 'translateX(-50%)' }}
          >
            <div className="rounded-[10px] border border-[#E5EAF2] bg-white p-3 shadow-lg min-w-[200px]">
              <div className="text-sm font-bold text-[#111827] mb-2">{task.title}</div>
              <div className="space-y-1 text-xs text-[#6B7280]">
                <div className="flex justify-between">
                  <span>开始</span>
                  <span className="font-medium text-[#111827]">{formatDateCN(task.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>结束</span>
                  <span className="font-medium text-[#111827]">{formatDateCN(task.endDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>进度</span>
                  <span className="font-medium text-[#2563EB]">{task.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

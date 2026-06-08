'use client';

// ============ 甘特图今日线组件 ============

import { useMemo } from 'react';
import type { GanttZoom } from '../hooks/gantt';
import { diffDays } from '../utils/dateUtils';

interface GanttTodayLineProps {
  startDate: Date;
  cellWidth: number;
  zoom: GanttZoom;
  totalHeight: number;
  offsetLeft?: number; // 左侧偏移量（用于左侧节点列表宽度）
}

export function GanttTodayLine({ startDate, cellWidth, zoom, totalHeight, offsetLeft = 0 }: GanttTodayLineProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 计算今日线的X坐标
  const x = useMemo(() => {
    const diff = diffDays(startDate, today);

    switch (zoom) {
      case 'day':
        return diff * cellWidth;
      case 'week':
        return (diff / 7) * cellWidth;
      case 'month':
        return (diff / 30) * cellWidth;
    }
  }, [startDate, today, cellWidth, zoom]);

  // 如果今日不在范围内，不渲染
  if (x < 0) return null;

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{ left: `${x + offsetLeft}px` }}
    >
      {/* 竖线 */}
      <div
        className="absolute top-0 w-0.5 bg-[#2563EB]"
        style={{ height: `${totalHeight}px` }}
      />

      {/* 今日标签 */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="rounded-[4px] bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-white">
          今天
        </span>
      </div>

      {/* 三角形指示器 */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
        <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-[#2563EB]" />
      </div>
    </div>
  );
}

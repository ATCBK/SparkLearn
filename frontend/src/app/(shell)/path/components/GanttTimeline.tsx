'use client';

// ============ 甘特图时间轴组件 ============

import { useMemo } from 'react';
import type { GanttZoom } from '../hooks/gantt';
import { generateDateRange, groupDatesByMonth, isToday, isWeekend, formatDateCN, getWeekLabel } from '../utils/dateUtils';

interface GanttTimelineProps {
  startDate: Date;
  endDate: Date;
  zoom: GanttZoom;
  cellWidth: number;
}

export function GanttTimeline({ startDate, endDate, zoom, cellWidth }: GanttTimelineProps) {
  // 生成日期数组
  const dates = useMemo(() => generateDateRange(startDate, endDate), [startDate, endDate]);

  // 按月分组
  const monthGroups = useMemo(() => groupDatesByMonth(dates), [dates]);

  // 根据缩放级别决定显示哪些日期刻度
  const displayDates = useMemo(() => {
    switch (zoom) {
      case 'day':
        return dates; // 显示每一天
      case 'week':
        return dates.filter((d) => d.getDay() === 1); // 只显示周一
      case 'month':
        return dates.filter((d) => d.getDate() === 1); // 只显示每月1号
    }
  }, [dates, zoom]);

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#E5EAF2]">
      {/* 月份行 */}
      <div className="flex h-8">
        {Array.from(monthGroups.entries()).map(([key, monthDates]) => (
          <div
            key={key}
            className="flex items-center justify-center border-r border-[#E5EAF2] text-xs font-bold text-[#111827]"
            style={{ width: monthDates.length * cellWidth }}
          >
            {monthDates[0].getFullYear()}年{monthDates[0].getMonth() + 1}月
          </div>
        ))}
      </div>

      {/* 日期刻度行 */}
      <div className="flex h-8 border-t border-[#F3F4F6]">
        {displayDates.map((date) => {
          const today = isToday(date);
          const weekend = isWeekend(date);

          return (
            <div
              key={date.toISOString()}
              className={`flex items-center justify-center text-[10px] border-r border-[#F3F4F6] ${
                today
                  ? 'bg-[#EFF6FF] text-[#2563EB] font-bold'
                  : weekend
                    ? 'bg-[#FAFBFC] text-[#9CA3AF]'
                    : 'text-[#6B7280]'
              }`}
              style={{ width: cellWidth }}
            >
              {zoom === 'day' ? (
                <div className="flex flex-col items-center">
                  <span className="text-[8px]">{getWeekDay(date)}</span>
                  <span>{date.getDate()}</span>
                </div>
              ) : zoom === 'week' ? (
                formatDateCN(date)
              ) : (
                `${date.getMonth() + 1}月`
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 获取星期几 */
function getWeekDay(date: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[date.getDay()];
}

'use client';

import { useMemo } from 'react';
import type { GanttZoom } from '../hooks/gantt';
import { generateDateRange, groupDatesByMonth, isToday, isWeekend, formatDateCN } from '../utils/dateUtils';

interface Props {
  startDate: Date;
  endDate: Date;
  zoom: GanttZoom;
  cellWidth: number;
}

export function GanttTimeline({ startDate, endDate, zoom, cellWidth }: Props) {
  const dates = useMemo(() => generateDateRange(startDate, endDate), [startDate, endDate]);
  const monthGroups = useMemo(() => groupDatesByMonth(dates), [dates]);

  const displayDates = useMemo(() => {
    switch (zoom) {
      case 'day':
        return dates;
      case 'week':
        return dates.filter((d) => d.getDay() === 1);
      case 'month':
        return dates.filter((d) => d.getDate() === 1);
    }
  }, [dates, zoom]);

  return (
    <div className="sticky top-0 z-10 border-b border-[#E5EAF2] bg-white">
      <div className="flex h-7">
        {Array.from(monthGroups.entries()).map(([key, monthDates]) => (
          <div
            key={key}
            className="flex items-center justify-center border-r border-[#E5EAF2] text-[10px] font-bold text-[#111827]"
            style={{ width: monthDates.length * cellWidth }}
          >
            {monthDates[0].getFullYear()}年{monthDates[0].getMonth() + 1}月
          </div>
        ))}
      </div>

      <div className="flex h-7 border-t border-[#F3F4F6]">
        {displayDates.map((date) => {
          const today = isToday(date);
          const weekend = isWeekend(date);

          return (
            <div
              key={date.toISOString()}
              className={`flex items-center justify-center border-r border-[#F3F4F6] text-[9px] ${
                today ? 'bg-[#EFF6FF] font-bold text-[#2563EB]' : weekend ? 'bg-[#FAFBFC] text-[#9CA3AF]' : 'text-[#6B7280]'
              }`}
              style={{ width: cellWidth }}
            >
              {zoom === 'day' ? (
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[8px]">{['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}</span>
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

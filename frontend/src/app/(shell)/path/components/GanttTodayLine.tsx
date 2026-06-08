'use client';

import { diffDays } from '../utils/dateUtils';

interface Props {
  startDate: Date;
  cellWidth: number;
  totalHeight: number;
  offsetLeft?: number;
}

export function GanttTodayLine({ startDate, cellWidth, totalHeight, offsetLeft = 220 }: Props) {
  const today = new Date();
  const daysFromStart = diffDays(startDate, today);
  const x = daysFromStart * cellWidth;

  return (
    <div
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: `${x + offsetLeft}px`, height: `${totalHeight}px` }}
    >
      <div className="h-full w-[2px] bg-[#2563EB]" />
    </div>
  );
}

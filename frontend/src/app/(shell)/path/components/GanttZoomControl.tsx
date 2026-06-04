'use client';

// ============ 甘特图缩放控制组件 ============

import type { GanttZoom } from '../hooks/gantt';

interface GanttZoomControlProps {
  zoom: GanttZoom;
  onChange: (zoom: GanttZoom) => void;
}

const ZOOM_OPTIONS: Array<{ value: GanttZoom; label: string; icon: string }> = [
  { value: 'day', label: '日', icon: 'D' },
  { value: 'week', label: '周', icon: 'W' },
  { value: 'month', label: '月', icon: 'M' },
];

export function GanttZoomControl({ zoom, onChange }: GanttZoomControlProps) {
  return (
    <div className="flex items-center gap-1 rounded-[8px] border border-[#E5EAF2] p-0.5 bg-[#F9FAFB]">
      {ZOOM_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-bold transition-all ${
            zoom === option.value
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'text-[#6B7280] hover:text-[#111827] hover:bg-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

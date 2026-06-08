'use client';

import type { GanttZoom } from '../hooks/gantt';

interface Props {
  zoom: GanttZoom;
  onChange: (zoom: GanttZoom) => void;
}

export function GanttZoomControl({ zoom, onChange }: Props) {
  const buttons: Array<{ key: GanttZoom; label: string }> = [
    { key: 'day', label: '日' },
    { key: 'week', label: '周' },
    { key: 'month', label: '月' },
  ];

  return (
    <div className="inline-flex items-center rounded-[10px] border border-[#E5EAF2] bg-white p-1">
      {buttons.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`rounded-[8px] px-3 py-1.5 text-xs font-bold transition-colors ${
            zoom === item.key ? 'bg-[#2563EB] text-white' : 'text-[#6B7280] hover:text-[#111827]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

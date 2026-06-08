'use client';

// ============ 视图切换按钮组件 ============

interface ViewToggleProps {
  viewMode: 'path' | 'gantt';
  onChange: (mode: 'path' | 'gantt') => void;
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 p-1 rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB]">
      {/* 卡片视图 */}
      <button
        onClick={() => onChange('path')}
        className={`flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-bold transition-all ${
          viewMode === 'path'
            ? 'bg-white text-[#2563EB] shadow-sm'
            : 'text-[#6B7280] hover:text-[#111827]'
        }`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        卡片
      </button>

      {/* 甘特图视图 */}
      <button
        onClick={() => onChange('gantt')}
        className={`flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-bold transition-all ${
          viewMode === 'gantt'
            ? 'bg-white text-[#2563EB] shadow-sm'
            : 'text-[#6B7280] hover:text-[#111827]'
        }`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="M7 8h10" />
          <path d="M7 12h6" />
          <path d="M7 16h8" />
        </svg>
        甘特图
      </button>
    </div>
  );
}

'use client'

interface ViewToggleProps {
  viewMode: 'path' | 'gantt'
  onChange: (mode: 'path' | 'gantt') => void
}

const MODE_META = {
  path: {
    title: '卡片视图',
    desc: '编辑步骤结构',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  gantt: {
    title: '甘特图',
    desc: '查看时间排期',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 8h10" />
        <path d="M7 12h6" />
        <path d="M7 16h8" />
      </svg>
    ),
  },
} as const

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="w-full max-w-[340px] rounded-[12px] border border-[#D9E4F2] bg-white p-1 shadow-sm">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onChange('path')}
          aria-pressed={viewMode === 'path'}
          className={`flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-bold transition-all ${
            viewMode === 'path'
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'bg-transparent text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#111827]'
          }`}
        >
          {MODE_META.path.icon}
          <span>{MODE_META.path.title}</span>
        </button>

        <button
          type="button"
          onClick={() => onChange('gantt')}
          aria-pressed={viewMode === 'gantt'}
          className={`flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-bold transition-all ${
            viewMode === 'gantt'
              ? 'bg-[#2563EB] text-white shadow-sm'
              : 'bg-transparent text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#111827]'
          }`}
        >
          {MODE_META.gantt.icon}
          <span>{MODE_META.gantt.title}</span>
        </button>
      </div>
      <div className="mt-1 grid grid-cols-2 text-center text-[10px] text-[#94A3B8]">
        <span>{MODE_META.path.desc}</span>
        <span>{MODE_META.gantt.desc}</span>
      </div>
    </div>
  )
}

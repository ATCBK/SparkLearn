'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { GanttTask } from '../hooks/gantt';
import { PHASE_COLORS, STATUS_COLORS, STATUS_TEXT } from '../utils/ganttUtils';
import { diffDays, formatDateCN } from '../utils/dateUtils';

interface TaskDetailPanelProps {
  task: GanttTask | null;
  onClose: () => void;
  onProgressChange?: (taskId: string, progress: number) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
}

export function TaskDetailPanel({ task, onClose, onProgressChange, onDateChange }: TaskDetailPanelProps) {
  const [progress, setProgress] = useState(task?.progress || 0);
  const [editingDate, setEditingDate] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState('');

  useEffect(() => {
    if (task) setProgress(task.progress);
  }, [task]);

  const handleProgressChange = useCallback(
    (value: number) => {
      const next = Math.min(100, Math.max(0, value));
      setProgress(next);
      if (task && onProgressChange) onProgressChange(task.id, next);
    },
    [task, onProgressChange],
  );

  const handleDateEditStart = (type: 'start' | 'end') => {
    setEditingDate(type);
    setTempDate(type === 'start' ? task?.startDate || '' : task?.endDate || '');
  };

  const handleDateSave = () => {
    if (task && onDateChange && tempDate) {
      if (editingDate === 'start') onDateChange(task.id, tempDate, task.endDate);
      else onDateChange(task.id, task.startDate, tempDate);
    }
    setEditingDate(null);
  };

  if (!task) return null;

  const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS.目标;
  const daysLeft = diffDays(new Date(), task.endDate);

  return (
    <div className="flex h-full flex-col bg-[#F9FAFB]">
      <div className="flex-1 overflow-visible p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: phaseColor.fill }} />
            <h3 className="text-sm font-bold text-[#111827]">任务详情</h3>
            <span className="text-xs text-[#6B7280]">第 {task.nodeIndex} 步</span>
          </div>
          <button onClick={onClose} className="rounded-[6px] p-1 transition-colors hover:bg-[#E5EAF2]">
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="text-lg font-bold text-[#111827]">{task.title}</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: phaseColor.light, color: phaseColor.fill }}
            >
              {task.phase}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ backgroundColor: `${STATUS_COLORS[task.status]}15`, color: STATUS_COLORS[task.status] }}
            >
              {STATUS_TEXT[task.status]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-1">开始日期</div>
            {editingDate === 'start' ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="w-24 rounded border border-[#2563EB] px-1 py-0.5 text-xs"
                  autoFocus
                />
                <button onClick={handleDateSave} className="text-[10px] font-bold text-[#2563EB]">
                  保存
                </button>
              </div>
            ) : (
              <div
                className="cursor-pointer text-sm font-bold text-[#111827] transition-colors hover:text-[#2563EB]"
                onClick={() => handleDateEditStart('start')}
              >
                {formatDateCN(task.startDate)}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-1">结束日期</div>
            {editingDate === 'end' ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="w-24 rounded border border-[#2563EB] px-1 py-0.5 text-xs"
                  autoFocus
                />
                <button onClick={handleDateSave} className="text-[10px] font-bold text-[#2563EB]">
                  保存
                </button>
              </div>
            ) : (
              <div
                className="cursor-pointer text-sm font-bold text-[#111827] transition-colors hover:text-[#2563EB]"
                onClick={() => handleDateEditStart('end')}
              >
                {formatDateCN(task.endDate)}
              </div>
            )}
          </div>

          <InfoItem label="预计时长" value={`${task.duration} 天`} />
          <InfoItem
            label="剩余天数"
            value={daysLeft > 0 ? `${daysLeft} 天` : '已到期'}
            highlight={daysLeft <= 2}
          />
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">学习进度</span>
            <span className="text-xs font-bold text-[#2563EB]">{progress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => handleProgressChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#E5EAF2]"
          />
        </div>

        <div className="flex gap-3">
          <Link
            href="/practice"
            className="flex-1 rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-center text-sm font-bold text-white"
          >
            开始学习
          </Link>
          <Link
            href="/generate"
            className="flex-1 rounded-[10px] border border-[#E5EAF2] bg-white px-4 py-2.5 text-center text-sm font-bold text-[#111827]"
          >
            查看资源
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] text-[#9CA3AF]">{label}</div>
      <div className={`text-sm font-bold ${highlight ? 'text-[#EF4444]' : 'text-[#111827]'}`}>
        {value}
      </div>
    </div>
  );
}

'use client';

// ============ 任务详情面板组件 ============

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { GanttTask } from '../hooks/gantt';
import { PHASE_COLORS, STATUS_TEXT, STATUS_COLORS } from '../utils/ganttUtils';
import { formatDateCN, diffDays } from '../utils/dateUtils';

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

  // 同步外部进度变化
  useState(() => {
    if (task) setProgress(task.progress);
  });

  // 处理进度变化
  const handleProgressChange = useCallback(
    (value: number) => {
      const newProgress = Math.min(100, Math.max(0, value));
      setProgress(newProgress);
      if (task && onProgressChange) {
        onProgressChange(task.id, newProgress);
      }
    },
    [task, onProgressChange]
  );

  // 处理日期编辑
  const handleDateEditStart = (type: 'start' | 'end') => {
    setEditingDate(type);
    setTempDate(type === 'start' ? task?.startDate || '' : task?.endDate || '');
  };

  const handleDateSave = () => {
    if (task && onDateChange && tempDate) {
      if (editingDate === 'start') {
        onDateChange(task.id, tempDate, task.endDate);
      } else {
        onDateChange(task.id, task.startDate, tempDate);
      }
    }
    setEditingDate(null);
  };

  if (!task) return null;

  const phaseColor = PHASE_COLORS[task.phase] || PHASE_COLORS['达标'];
  const daysLeft = diffDays(new Date(), task.endDate);

  return (
    <div className="border-t border-[#E5EAF2] bg-[#F9FAFB]">
      <div className="p-4">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: phaseColor.fill }}
            />
            <h3 className="text-sm font-bold text-[#111827]">任务详情</h3>
            <span className="text-xs text-[#6B7280]">第 {task.nodeIndex} 步</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#E5EAF2] rounded-[6px] transition-colors"
          >
            <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 任务名称 */}
        <div className="mb-4">
          <div className="text-lg font-bold text-[#111827]">{task.title}</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: phaseColor.light,
                color: phaseColor.fill,
              }}
            >
              {task.phase}阶段
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: `${STATUS_COLORS[task.status]}15`,
                color: STATUS_COLORS[task.status],
              }}
            >
              {STATUS_TEXT[task.status]}
            </span>
          </div>
        </div>

        {/* 信息网格 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {/* 开始日期（可编辑） */}
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-1">开始日期</div>
            {editingDate === 'start' ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="text-xs border border-[#2563EB] rounded px-1 py-0.5 w-24"
                  autoFocus
                />
                <button
                  onClick={handleDateSave}
                  className="text-[10px] text-[#2563EB] font-bold"
                >
                  保存
                </button>
              </div>
            ) : (
              <div
                className="text-sm font-bold text-[#111827] cursor-pointer hover:text-[#2563EB] transition-colors"
                onClick={() => handleDateEditStart('start')}
                title="点击修改开始日期"
              >
                {formatDateCN(task.startDate)}
                <span className="text-[10px] text-[#9CA3AF] ml-1">✎</span>
              </div>
            )}
          </div>

          {/* 结束日期（可编辑） */}
          <div>
            <div className="text-[10px] text-[#9CA3AF] mb-1">结束日期</div>
            {editingDate === 'end' ? (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  className="text-xs border border-[#2563EB] rounded px-1 py-0.5 w-24"
                  autoFocus
                />
                <button
                  onClick={handleDateSave}
                  className="text-[10px] text-[#2563EB] font-bold"
                >
                  保存
                </button>
              </div>
            ) : (
              <div
                className="text-sm font-bold text-[#111827] cursor-pointer hover:text-[#2563EB] transition-colors"
                onClick={() => handleDateEditStart('end')}
                title="点击修改结束日期"
              >
                {formatDateCN(task.endDate)}
                <span className="text-[10px] text-[#9CA3AF] ml-1">✎</span>
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

        {/* 学习进度 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#6B7280]">学习进度</span>
            <span className="text-xs font-bold text-[#2563EB]">{progress}%</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full h-2 bg-[#E5EAF2] rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-[#2563EB]
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            {/* 进度标记 */}
            <div className="flex justify-between mt-1 px-0.5">
              {[0, 25, 50, 75, 100].map((mark) => (
                <div
                  key={mark}
                  className={`text-[8px] ${progress >= mark ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}
                >
                  {mark}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Link
            href="/practice"
            className="flex-1 rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors text-center"
          >
            开始学习
          </Link>
          <Link
            href="/generate"
            className="flex-1 rounded-[10px] border border-[#E5EAF2] bg-white px-4 py-2.5 text-sm font-bold text-[#111827] hover:border-[#2563EB] transition-colors text-center"
          >
            查看资源
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 信息项组件 */
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
      <div className="text-[10px] text-[#9CA3AF] mb-1">{label}</div>
      <div
        className={`text-sm font-bold ${
          highlight ? 'text-[#EF4444]' : 'text-[#111827]'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

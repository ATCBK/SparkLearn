'use client';

// ============ 甘特图左侧路径节点列表组件（支持节点完成） ============

import { useMemo, useCallback } from 'react';
import type { EditablePhase } from '@/lib/api/types';
import type { GanttTask } from '../hooks/gantt';
import { PHASE_COLORS_BY_ID, STATUS_TEXT, STATUS_COLORS } from '../utils/ganttUtils';
import { formatDateCN } from '../utils/dateUtils';

interface GanttPathNodeListProps {
  phases: EditablePhase[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onTaskComplete?: (taskId: string, completed: boolean) => void;
  tasks: GanttTask[];
}

export function GanttPathNodeList({
  phases,
  selectedNodeId,
  onNodeSelect,
  onTaskComplete,
  tasks,
}: GanttPathNodeListProps) {
  // 计算全局序号
  const getGlobalIndex = (nodeId: string): number => {
    let idx = 0;
    for (const phase of phases) {
      for (const node of phase.nodes) {
        idx++;
        if (node.id === nodeId) return idx;
      }
    }
    return 0;
  };

  const taskByNodeId = useMemo(() => new Map(tasks.map((task) => [task.nodeId, task])), [tasks]);

  // 计算每个阶段的进度
  const phaseProgress = useMemo(() => {
    return phases.map((phase) => {
      const phaseTasks = phase.nodes
        .map((n) => taskByNodeId.get(n.id))
        .filter(Boolean) as GanttTask[];

      if (phaseTasks.length === 0) return 0;
      const completedCount = phaseTasks.filter((t) => t.status === 'completed').length;
      return Math.round((completedCount / phaseTasks.length) * 100);
    });
  }, [phases, taskByNodeId]);

  // 处理完成状态切换
  const handleCompleteToggle = useCallback(
    (e: React.MouseEvent, task: GanttTask) => {
      e.stopPropagation();
      if (onTaskComplete) {
        const newCompleted = task.status !== 'completed';
        onTaskComplete(task.id, newCompleted);
      }
    },
    [onTaskComplete]
  );

  return (
    <div className="w-1/3 min-w-[280px] max-w-[360px] border-r border-[#E5EAF2] overflow-y-auto bg-white">
      <div className="p-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#111827]">学习路径</h3>
          <span className="text-xs text-[#6B7280]">{tasks.length} 个任务</span>
        </div>

        {/* 阶段列表 */}
        {phases.map((phase, phaseIdx) => {
          const phaseColor = PHASE_COLORS_BY_ID[phase.id - 1] || '#94A3B8';
          const progress = phaseProgress[phaseIdx];

          return (
            <div key={phase.id} className="mb-6">
              {/* 阶段标题 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: phaseColor }}
                  />
                  <span className="text-xs font-bold text-[#111827]">{phase.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-[#E5EAF2] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: phaseColor,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[#6B7280]">{progress}%</span>
                </div>
              </div>

              {/* 节点列表 */}
              <div className="space-y-1 ml-3">
                {phase.nodes.map((node, nodeIdx) => {
                  const task = getTaskForNode(node.id);
                  const isSelected = selectedNodeId === node.id;
                  const globalIdx = getGlobalIndex(node.id);
                  const isCompleted = task?.status === 'completed';

                  return (
                    <div key={node.id}>
                      {/* 节点卡片 */}
                      <div
                        onClick={() => onNodeSelect(node.id)}
                        className={`w-full text-left rounded-[10px] p-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#2563EB] bg-[#F8FAFF] shadow-sm'
                            : 'border border-[#E5EAF2] bg-white hover:border-[#93C5FD] hover:bg-[#FAFBFC]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 完成按钮（单选样式） */}
                          <button
                            onClick={(e) => task && handleCompleteToggle(e, task)}
                            className="flex-shrink-0 mt-0.5"
                            title={isCompleted ? '标记为未完成' : '标记为已完成'}
                          >
                            {isCompleted ? (
                              // 已完成状态：实心圆勾选
                              <div className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              // 未完成状态：空心圆
                              <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] hover:border-[#2563EB] transition-colors" />
                            )}
                          </button>

                          {/* 节点内容 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm font-bold leading-tight ${
                                    isCompleted
                                      ? 'text-[#9CA3AF] line-through'
                                      : 'text-[#111827]'
                                  }`}
                                >
                                  {node.title}
                                </div>
                                {task && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span className="text-[10px] text-[#9CA3AF]">
                                      {formatDateCN(task.startDate)}
                                    </span>
                                    <span className="text-[10px] text-[#D1D5DB]">→</span>
                                    <span className="text-[10px] text-[#9CA3AF]">
                                      {formatDateCN(task.endDate)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 状态标签 */}
                              {task && (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0"
                                  style={{
                                    backgroundColor: isCompleted ? '#D1FAE5' : `${STATUS_COLORS[task.status]}15`,
                                    color: isCompleted ? '#16A34A' : STATUS_COLORS[task.status],
                                  }}
                                >
                                  {isCompleted ? '已完成' : task.progress > 0 ? `${task.progress}%` : STATUS_TEXT[task.status]}
                                </span>
                              )}
                            </div>

                            {/* 进度条（未完成时显示） */}
                            {task && !isCompleted && task.progress > 0 && (
                              <div className="mt-2">
                                <div className="h-1 bg-[#E5EAF2] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${task.progress}%`,
                                      backgroundColor: phaseColor,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 序号 */}
                        <div className="mt-1.5 ml-8">
                          <span className="text-[10px] text-[#9CA3AF]">第 {globalIdx} 步</span>
                        </div>
                      </div>

                      {/* 连接线（非最后一个节点） */}
                      {nodeIdx < phase.nodes.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <div className="w-0.5 h-3 bg-[#E5EAF2]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 阶段间分隔线 */}
              {phaseIdx < phases.length - 1 && (
                <div className="mt-4 mb-2 border-t border-dashed border-[#E5EAF2]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

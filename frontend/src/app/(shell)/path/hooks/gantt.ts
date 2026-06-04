// ============ 甘特图类型定义 ============

/** 甘特图任务状态 */
export type GanttTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** 甘特图任务 */
export interface GanttTask {
  id: string;
  nodeId: string;           // 关联路径节点ID
  title: string;
  phase: '补弱' | '达标' | '目标';
  phaseId: number;          // 1 | 2 | 3

  // 时间属性
  startDate: string;        // ISO日期 YYYY-MM-DD
  endDate: string;          // ISO日期 YYYY-MM-DD
  duration: number;         // 预计天数
  actualStartDate?: string; // 实际开始日期
  actualEndDate?: string;   // 实际完成日期

  // 进度属性
  progress: number;         // 0-100 完成百分比
  status: GanttTaskStatus;

  // 学习属性
  estimatedHours: number;   // 预计学习时长(小时)
  actualHours?: number;     // 实际学习时长
  difficulty: 1 | 2 | 3 | 4 | 5;
  priority: 'high' | 'medium' | 'low';

  // 依赖关系
  dependencies: string[];   // 前置任务ID列表
  isCriticalPath: boolean;  // 是否在关键路径上

  // 元数据
  nodeIndex: number;        // 在路径中的序号
}

/** 甘特图阶段 */
export interface GanttPhase {
  id: number;
  title: string;
  color: string;
  tasks: GanttTask[];
}

/** 甘特图计划 */
export interface GanttPlan {
  planId: string;
  target: string;
  createdAt: string;
  updatedAt: string;
  totalDays: number;
  dailyHours: number;
  phases: GanttPhase[];
  milestones: GanttMilestone[];
}

/** 甘特图里程碑 */
export interface GanttMilestone {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'goal' | 'checkpoint';
  relatedTaskIds: string[];
}

/** 时间轴缩放级别 */
export type GanttZoom = 'day' | 'week' | 'month';

/** 甘特图视图状态 */
export interface GanttViewState {
  zoom: GanttZoom;
  scrollLeft: number;
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
}

/** 拖拽状态 */
export interface DragState {
  taskId: string;
  edge: 'left' | 'right' | 'center';
  startX: number;
  originalStart: string;
  originalEnd: string;
}

/** 日期范围 */
export interface DateRange {
  start: Date;
  end: Date;
}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePathEditor } from '@/hooks/usePathEditor'
import { useGanttData } from './hooks/useGanttData'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { ViewToggle } from './components/ViewToggle'
import { GanttContainer } from './components/GanttContainer'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { GanttZoomControl } from './components/GanttZoomControl'
import type { EditablePhase, EditablePathNode } from '@/lib/api/types'

// ============ 默认数据（静态兜底） ============
const DEFAULT_PHASES: EditablePhase[] = [
  {
    id: 1,
    title: '补弱阶段',
    description: '夯实基础',
    nodes: [
      { id: 'node-1', title: '回看返回值短讲义', source: 'ai' },
      { id: 'node-2', title: '补清作用域混淆', source: 'ai' },
      { id: 'node-3', title: '做 5 题补弱练习', source: 'ai' },
      { id: 'node-4', title: '阶段完成', source: 'ai' },
    ],
  },
  {
    id: 2,
    title: '达标阶段',
    description: '能力达标',
    nodes: [
      { id: 'node-5', title: '回顾函数定义', source: 'ai' },
      { id: 'node-6', title: '完成返回值理解', source: 'ai' },
      { id: 'node-7', title: '完成 8 题达标练习', source: 'ai' },
      { id: 'node-8', title: '进入模块导入', source: 'ai' },
    ],
  },
  {
    id: 3,
    title: '目标阶段',
    description: '应用提升',
    nodes: [
      { id: 'node-9', title: '进入模块导入', source: 'ai' },
      { id: 'node-10', title: '学习文件读写', source: 'ai' },
      { id: 'node-11', title: '完成成绩统计项目', source: 'ai' },
      { id: 'node-12', title: '项目完成', source: 'ai' },
    ],
  },
]

const PHASE_COLORS = ['#16A34A', '#2563EB', '#94A3B8'] as const
const PHASE_DESCS = ['夯实基础', '能力达标', '应用提升']

const DEFAULT_SUGGESTIONS = [
  { id: 1, text: '先补返回值，再补作用域', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 2, text: '资源 10 分钟 + 练习 5 题', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 3, text: '卡住就换一种讲法', desc: '根据当前画像、推荐和路径状态自动推荐。' },
]

// ============ 工具函数 ============

/** 将 AI 返回的 phases 转为可编辑格式 */
function toEditablePhases(rawPhases: any[]): EditablePhase[] {
  if (!Array.isArray(rawPhases) || rawPhases.length === 0) return DEFAULT_PHASES
  return rawPhases.slice(0, 3).map((p: any, pIdx: number) => ({
    id: (pIdx + 1) as 1 | 2 | 3,
    title: String(p.title || `阶段 ${pIdx + 1}`),
    description: String(p.description || PHASE_DESCS[pIdx] || ''),
    nodes: Array.isArray(p.nodes)
      ? p.nodes.map((n: any) => ({
          id: String(n.id ?? `node-${Math.random().toString(36).slice(2, 8)}`),
          title: String(n.title || '未命名步骤'),
          source: (n.source === 'user' ? 'user' : 'ai') as 'ai' | 'user',
        }))
      : [],
  }))
}

/** 计算节点全局序号 */
function getGlobalIndex(phases: EditablePhase[], nodeId: string): number {
  let idx = 0
  for (const phase of phases) {
    for (const node of phase.nodes) {
      if (node.id === nodeId) return idx + 1
      idx++
    }
  }
  return 0
}

// ============ 主组件 ============
export default function PathPage() {
  const [targetInput, setTargetInput] = useState('我想自己写一个成绩统计程序')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-5')
  const [generatedSuggestions, setGeneratedSuggestions] = useState(DEFAULT_SUGGESTIONS)
  const [generatedResources, setGeneratedResources] = useState<
    Array<{ id: number; title: string; tag: string; link?: string }>
  >([])
  const [loading, setLoading] = useState(false)
  const [nodeLoading, setNodeLoading] = useState(false)
  const [pathId, setPathId] = useState('')
  const [viewMode, setViewMode] = useState<'path' | 'gantt'>('path')
  const requestSeqRef = useRef(0)

  // 编辑器 Hook
  const editor = usePathEditor(DEFAULT_PHASES, pathId, targetInput)

  // 甘特图数据 Hook
  const gantt = useGanttData(editor.phases, { initialZoom: 'week', dailyHours: 2 })

  // 加载真实资源作为资源推送
  useEffect(() => {
    api
      .getRecentResources()
      .then((data) => {
        const mapped = data.slice(0, 3).map((r, idx) => ({
          id: idx + 1,
          title: r.title,
          tag:
            r.type === 'document'
              ? '文档'
              : r.type === 'ppt'
                ? 'PPT'
                : r.type === 'mindmap'
                  ? '思维导图'
                  : r.type,
          link: `/generate?view=library&id=${r.id}`,
        }))
        if (mapped.length > 0) setGeneratedResources(mapped)
      })
      .catch(() => {})
  }, [])

  // 节点点击获取建议
  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      setSelectedNodeId(nodeId)

      // 找到节点信息
      let node: EditablePathNode | undefined
      let phaseTitle = '当前阶段'
      for (const phase of editor.phases) {
        const found = phase.nodes.find((n) => n.id === nodeId)
        if (found) {
          node = found
          phaseTitle = phase.title
          break
        }
      }
      if (!node) return

      const seq = ++requestSeqRef.current
      setNodeLoading(true)

      try {
        // 状态推断：第一个节点 current，其余 locked
        const firstNodeId = editor.phases[0]?.nodes[0]?.id
        const nodeStatus = nodeId === firstNodeId ? 'current' : 'locked'

        const resp = await api.getPathNodeSuggestions({
          nodeTitle: node.title,
          nodeGoal: node.title,
          nodeStatus: nodeStatus,
          phaseTitle,
          target: targetInput,
        })

        if (seq !== requestSeqRef.current) return

        if (resp.suggestions.length > 0) setGeneratedSuggestions(resp.suggestions)
        if (resp.resources.length > 0) setGeneratedResources(resp.resources)
      } catch (error) {
        console.error('Failed to get node suggestions:', error)
        if (seq !== requestSeqRef.current) return
        setGeneratedSuggestions([
          { id: 1, text: `先学习 ${node.title}`, desc: '根据当前节点自动推荐的学习路径。' },
          { id: 2, text: `完成 ${node.title} 相关练习`, desc: '根据当前节点自动推荐的练习任务。' },
          { id: 3, text: `掌握 ${node.title} 的核心概念`, desc: '根据当前节点自动推荐的学习重点。' },
        ])
      } finally {
        if (seq === requestSeqRef.current) setNodeLoading(false)
      }
    },
    [editor.phases, targetInput],
  )

  // 重新生成路径（直接覆盖）
  const handleRegeneratePath = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.generatePathPlanning(targetInput)
      if (data) {
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setGeneratedSuggestions(data.suggestions)
        }
        if (Array.isArray(data.resources) && data.resources.length > 0) {
          setGeneratedResources(data.resources)
        }
        if (data.pathId) setPathId(data.pathId)

        const editablePhases = toEditablePhases(data.phases ?? [])
        editor.replaceAll(editablePhases)

        // 重新生成甘特图
        gantt.regenerate(editablePhases)

        if (editablePhases[0]?.nodes[0]) {
          setSelectedNodeId(editablePhases[0].nodes[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to generate path planning:', error)
    } finally {
      setLoading(false)
    }
  }, [targetInput, editor, gantt])

  // 甘特图节点选择（同步到左侧）
  const handleGanttNodeSelect = useCallback(
    (taskId: string | null) => {
      if (!taskId) {
        gantt.selectTask(null)
        return
      }

      gantt.selectTask(taskId)

      // 找到对应的节点ID
      const task = gantt.getTask(taskId)
      if (task) {
        setSelectedNodeId(task.nodeId)
      }
    },
    [gantt],
  )

  // 左侧节点选择（同步到甘特图）
  const handlePathNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)

      // 找到对应的甘特图任务
      const task = gantt.allTasks.find((t) => t.nodeId === nodeId)
      if (task) {
        gantt.selectTask(task.id)
      }

      // 获取建议
      handleNodeClick(nodeId)
    },
    [gantt, handleNodeClick],
  )

  // 日期变更处理
  const handleDateChange = useCallback(
    (taskId: string, startDate: string, endDate: string) => {
      gantt.updateTaskDate(taskId, startDate, endDate);
    },
    [gantt],
  )

  // 任务完成状态切换
  const handleTaskComplete = useCallback(
    (taskId: string, completed: boolean) => {
      gantt.updateProgress(taskId, completed ? 100 : 0);
    },
    [gantt],
  )

  return (
    <>
      {/* 页面标题区 */}
      <PageHeader />

      <div>
        {/* 摘要条 + 视图切换 */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SummaryBar />
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* 主体区域 */}
        {viewMode === 'path' ? (
          /* 原有卡片视图 */
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_320px] gap-2 max-[980px]:grid-cols-1">
            {/* 左侧：阶段路径回路 */}
            <div className="min-w-0">
              <PathCircuitCard
                editor={editor}
                targetInput={targetInput}
                setTargetInput={setTargetInput}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={handleNodeClick}
                onRegeneratePath={handleRegeneratePath}
                loading={loading}
              />
            </div>

            {/* 右侧：建议栏 */}
            <div className="min-w-0">
              <SuggestionPanel
                selectedNodeId={selectedNodeId}
                suggestions={generatedSuggestions}
                resources={generatedResources}
                loading={nodeLoading}
                phases={editor.phases}
              />
            </div>
          </div>
        ) : (
          /* 甘特图视图 */
          <div
            className="mt-6 rounded-[14px] border border-[#E5EAF2] bg-white shadow-sm overflow-hidden flex flex-col"
            style={{ height: 'calc(100vh - 280px)' }}
          >
            {/* 甘特图工具栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5EAF2]">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-[#111827]">学习甘特图</h2>
                <span className="text-xs text-[#6B7280]">
                  {gantt.stats.total} 个任务 · 已完成 {gantt.stats.completed} · 进行中{' '}
                  {gantt.stats.inProgress}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* 总体进度 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280]">总体进度</span>
                  <div className="w-24 h-1.5 bg-[#E5EAF2] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded-full transition-all"
                      style={{ width: `${gantt.overallProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#2563EB]">{gantt.overallProgress}%</span>
                </div>
                {/* 缩放控制 */}
                <GanttZoomControl zoom={gantt.zoom} onChange={gantt.setZoom} />
              </div>
            </div>

            {/* 甘特图主体（统一容器，左右同步滚动） */}
            <div className="flex-1 overflow-hidden">
              <GanttContainer
                phases={editor.phases}
                tasks={gantt.allTasks}
                milestones={gantt.plan?.milestones || []}
                zoom={gantt.zoom}
                selectedTaskId={gantt.selectedTaskId}
                hoveredTaskId={gantt.hoveredTaskId}
                onTaskSelect={handleGanttNodeSelect}
                onTaskHover={gantt.hoverTask}
                onProgressChange={gantt.updateProgress}
                onDateChange={handleDateChange}
                onTaskComplete={handleTaskComplete}
              />
            </div>

            {/* 任务详情面板 */}
            {gantt.selectedTask && (
              <TaskDetailPanel
                task={gantt.selectedTask}
                onClose={() => handleGanttNodeSelect(null)}
                onProgressChange={gantt.updateProgress}
                onDateChange={handleDateChange}
              />
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ============ 页面标题 ============
function PageHeader() {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-[#2563EB]">学习路径 / 你现在要走的下一步</div>
      <h1 className="mt-2 text-3xl font-bold text-[#111827]">个性化学习路径</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        生成路径后可自由编辑步骤：添加、删除、移动、修改标题，最多 12 步。切换到甘特图视图查看时间安排。
      </p>
    </div>
  )
}

// ============ 摘要条 ============
function SummaryBar() {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm flex-1">
      <div className="grid grid-cols-5 gap-px max-[1080px]:grid-cols-3 max-[760px]:grid-cols-2 max-[760px]:gap-4">
        <div className="border-r border-[#E5EAF2] pr-6">
          <div className="text-xs text-[#6B7280]">当前目标</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">Python 函数与模块</div>
        </div>
        <div className="border-r border-[#E5EAF2] px-6">
          <div className="text-xs text-[#6B7280]">路径进度</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-12 w-12">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#E5EAF2" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="8"
                  strokeDasharray={`${(62 / 100) * 282.7} 282.7`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#111827]">
                62%
              </div>
            </div>
          </div>
        </div>
        <div className="border-r border-[#E5EAF2] px-6">
          <div className="text-xs text-[#6B7280]">当前阶段</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">达标阶段</div>
          <div className="text-xs text-[#6B7280]">第 2 / 3 阶段</div>
        </div>
        <div className="border-r border-[#E5EAF2] px-6">
          <div className="text-xs text-[#6B7280]">当前重点</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">先补返回值</div>
          <div className="text-xs text-[#6B7280]">通过后再进模块导入</div>
        </div>
        <div className="flex flex-col gap-2 pl-6">
          <Link
            href="/path"
            className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors text-center"
          >
            开始今日路径
          </Link>
          <button
            onClick={() =>
              document.querySelector<HTMLInputElement>('[data-target-input]')?.focus()
            }
            className="rounded-[10px] border border-[#E5EAF2] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:border-[#2563EB] transition-colors"
          >
            调整目标
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ 阶段路径回路卡片 ============
interface PathCircuitCardProps {
  editor: ReturnType<typeof usePathEditor>
  targetInput: string
  setTargetInput: (v: string) => void
  selectedNodeId: string | null
  setSelectedNodeId: (id: string) => void
  onRegeneratePath: () => void
  loading: boolean
}

function PathCircuitCard({
  editor,
  targetInput,
  setTargetInput,
  selectedNodeId,
  setSelectedNodeId,
  onRegeneratePath,
  loading,
}: PathCircuitCardProps) {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
      {/* 标题 + 目标设定 */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[#111827]">阶段路径回路</h2>
          <span className="text-xs text-[#9CA3AF]">
            {editor.totalNodes} / 12 步
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="输入目标，AI 会重排路径…"
            data-target-input
            className="h-9 w-64 rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB] px-3 text-sm outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />
          <button
            onClick={onRegeneratePath}
            disabled={loading}
            className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {loading ? '生成中...' : '重新生成'}
          </button>
        </div>
      </div>

      {/* 路径图画布 */}
      <PathCanvas
        phases={editor.phases}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        editor={editor}
      />

      {/* 图例 */}
      <div className="mt-4 flex gap-6 text-xs font-bold">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#16A34A]" />
          <span className="text-[#6B7280]">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#2563EB]" />
          <span className="text-[#6B7280]">当前阶段</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#94A3B8]" />
          <span className="text-[#6B7280]">未开始</span>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="mt-4 flex gap-3 flex-wrap">
        <Link
          href="/generate"
          className="rounded-[10px] bg-[#2563EB] px-6 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors"
        >
          学习当前节点资源
        </Link>
        <Link
          href="/practice"
          className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-2 text-sm font-bold text-[#2563EB] hover:border-[#2563EB] transition-colors"
        >
          进入当前节点练习
        </Link>
        <Link
          href="/generate"
          className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-2 text-sm font-bold text-[#111827] hover:border-[#E5EAF2] transition-colors"
        >
          生成补弱资源
        </Link>
      </div>
    </div>
  )
}

// ============ 路径图画布 ============
interface PathCanvasProps {
  phases: EditablePhase[]
  selectedNodeId: string | null
  setSelectedNodeId: (id: string) => void
  editor: ReturnType<typeof usePathEditor>
}

function PathCanvas({ phases, selectedNodeId, setSelectedNodeId, editor }: PathCanvasProps) {
  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <PhaseStrip
          key={phase.id}
          phase={phase}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          editor={editor}
          globalOffset={phases
            .slice(0, phase.id - 1)
            .reduce((s, p) => s + p.nodes.length, 0)}
        />
      ))}
    </div>
  )
}

// ============ 阶段条 ============
interface PhaseStripProps {
  phase: EditablePhase
  selectedNodeId: string | null
  setSelectedNodeId: (id: string) => void
  editor: ReturnType<typeof usePathEditor>
  globalOffset: number
}

function PhaseStrip({
  phase,
  selectedNodeId,
  setSelectedNodeId,
  editor,
  globalOffset,
}: PhaseStripProps) {
  const [addInputValue, setAddInputValue] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus()
  }, [showAddInput])

  const handleAddConfirm = () => {
    if (addInputValue.trim()) {
      editor.addNode(phase.id, addInputValue.trim())
      setAddInputValue('')
      setShowAddInput(false)
    }
  }

  // 判断每个节点是否可以上移/下移
  const canMoveUp = (nodeIdx: number) => {
    return nodeIdx > 0 || phase.id > 1
  }
  const canMoveDown = (nodeIdx: number) => {
    return nodeIdx < phase.nodes.length - 1 || phase.id < 3
  }

  return (
    <div className="flex gap-4 items-start">
      {/* 右侧节点行 */}
      <div className="flex-1 flex gap-4 items-center overflow-x-auto pb-2">
        {phase.nodes.length === 0 ? (
          /* 空阶段占位 */
          <EmptyPhasePlaceholder
            phaseId={phase.id}
            onAdd={(title) => editor.addNode(phase.id, title)}
            disabled={!editor.canAdd}
          />
        ) : (
          phase.nodes.map((node, idx) => (
            <div key={node.id} className="flex items-center gap-4 flex-shrink-0">
              {/* 节点 */}
              <PathNode
                node={node}
                index={globalOffset + idx + 1}
                isSelected={selectedNodeId === node.id}
                canMoveUp={canMoveUp(idx)}
                canMoveDown={canMoveDown(idx)}
                canDelete={editor.canDelete}
                onClick={() => setSelectedNodeId(node.id)}
                onDelete={() => editor.deleteNode(node.id)}
                onMoveUp={() => editor.moveNode(node.id, 'up')}
                onMoveDown={() => editor.moveNode(node.id, 'down')}
                onEditTitle={(newTitle) => editor.editNodeTitle(node.id, newTitle)}
              />

              {/* 连接箭头 */}
              {idx < phase.nodes.length - 1 && (
                <div className="flex-shrink-0 text-[#111827] text-lg font-bold">→</div>
              )}

              {/* 最后一个节点显示旗子 */}
              {idx === phase.nodes.length - 1 && phase.id === 3 && (
                <div className="flex-shrink-0 text-2xl">🚩</div>
              )}
            </div>
          ))
        )}

        {/* 添加步骤按钮（非空阶段） */}
        {phase.nodes.length > 0 && (
          <div className="flex-shrink-0">
            {showAddInput ? (
              <div className="flex items-center gap-2">
                <input
                  ref={addInputRef}
                  value={addInputValue}
                  onChange={(e) => setAddInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddConfirm()
                    if (e.key === 'Escape') {
                      setShowAddInput(false)
                      setAddInputValue('')
                    }
                  }}
                  placeholder="步骤名称"
                  className="h-9 w-36 rounded-[10px] border border-[#2563EB] bg-white px-3 text-sm outline-none"
                />
                <button
                  onClick={handleAddConfirm}
                  className="h-9 rounded-[10px] bg-[#2563EB] px-3 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors"
                >
                  添加
                </button>
                <button
                  onClick={() => {
                    setShowAddInput(false)
                    setAddInputValue('')
                  }}
                  className="text-xs text-[#6B7280] hover:text-[#111827]"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddInput(true)}
                disabled={!editor.canAdd}
                className="flex h-[96px] w-[56px] flex-shrink-0 items-center justify-center rounded-[12px] border-2 border-dashed border-[#E5EAF2] text-[#D1D5DB] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={editor.canAdd ? '添加步骤' : '已达上限 12 步'}
              >
                <span className="text-2xl leading-none">+</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 空阶段占位 ============
interface EmptyPhasePlaceholderProps {
  phaseId: 1 | 2 | 3
  onAdd: (title: string) => void
  disabled: boolean
}

function EmptyPhasePlaceholder({ phaseId, onAdd, disabled }: EmptyPhasePlaceholderProps) {
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  const handleConfirm = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim())
      setInputValue('')
      setShowInput(false)
    }
  }

  if (disabled) {
    return (
      <div className="flex-1 rounded-[12px] border-2 border-dashed border-[#E5EAF2] bg-[#FAFBFC] p-8 text-center">
        <span className="text-sm text-[#D1D5DB]">暂无步骤（已达上限 12 步）</span>
      </div>
    )
  }

  return (
    <div className="flex-1 rounded-[12px] border-2 border-dashed border-[#E5EAF2] bg-[#FAFBFC] p-8 text-center">
      {showInput ? (
        <div className="flex items-center gap-2 justify-center">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
              if (e.key === 'Escape') {
                setShowInput(false)
                setInputValue('')
              }
            }}
            placeholder="输入步骤名称"
            className="h-8 w-48 rounded-[8px] border border-[#E5EAF2] px-3 text-sm outline-none focus:border-[#2563EB]"
          />
          <button
            onClick={handleConfirm}
            className="h-8 rounded-[8px] bg-[#2563EB] px-3 text-xs font-bold text-white"
          >
            添加
          </button>
          <button
            onClick={() => {
              setShowInput(false)
              setInputValue('')
            }}
            className="text-xs text-[#6B7280]"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="text-sm text-[#9CA3AF] hover:text-[#2563EB] transition-colors"
        >
          暂无步骤，点击 + 添加
        </button>
      )}
    </div>
  )
}

// ============ 路径节点 ============
interface PathNodeProps {
  node: EditablePathNode
  index: number
  isSelected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canDelete: boolean
  onClick: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onEditTitle: (newTitle: string) => void
}

function PathNode({
  node,
  index,
  isSelected,
  canMoveUp,
  canMoveDown,
  canDelete,
  onClick,
  onDelete,
  onMoveUp,
  onMoveDown,
  onEditTitle,
}: PathNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.title)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setEditValue(node.title)
      editInputRef.current?.focus()
    }
  }, [isEditing, node.title])

  const handleEditConfirm = () => {
    if (editValue.trim()) {
      onEditTitle(editValue.trim())
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete()
    setShowDeleteConfirm(false)
  }

  // 节点状态样式：只有第一步是"当前"，其余全部"未开始"
  const isFirstNode = index === 1
  const nodeStyle = isFirstNode
    ? {
        border: '2px solid #2563EB',
        background: '#F8FAFF',
        shadow: isSelected ? '0 8px 20px rgba(37, 99, 235, 0.12)' : 'none',
        statusText: '当前节点',
        statusBg: '#DBEAFE',
        statusColor: '#2563EB',
      }
    : {
        border: '1px solid #E5EAF2',
        background: '#FFFFFF',
        shadow: 'none',
        statusText: '未开始',
        statusBg: '#F3F4F6',
        statusColor: '#94A3B8',
      }

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        }}
        className="relative rounded-[12px] p-3 text-left transition-all hover:shadow-md flex flex-col justify-between cursor-pointer"
        style={{
          border: nodeStyle.border,
          background: nodeStyle.background,
          boxShadow: isSelected ? nodeStyle.shadow : 'none',
          width: '168px',
          height: '96px',
          minWidth: '168px',
          minHeight: '96px',
        }}
      >
        {/* 编辑/删除按钮栏（hover 显示） */}
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* 编辑 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E5EAF2] text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors shadow-sm"
            title="编辑标题"
          >
            <span className="text-xs">✎</span>
          </button>
          {/* 删除 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!canDelete) return
                setShowDeleteConfirm(true)
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E5EAF2] transition-colors shadow-sm ${
                canDelete
                  ? 'text-[#6B7280] hover:border-[#EF4444] hover:text-[#EF4444]'
                  : 'text-[#D1D5DB] cursor-not-allowed'
              }`}
              title={canDelete ? '删除步骤' : '至少保留 1 步'}
            >
              <span className="text-xs">×</span>
            </button>
            {/* 删除确认气泡 */}
            {showDeleteConfirm && (
              <div className="absolute top-8 right-0 z-20 w-40 rounded-[10px] border border-[#E5EAF2] bg-white p-3 shadow-lg">
                <div className="text-xs text-[#111827] mb-2">删除此步骤？</div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete()
                    }}
                    className="flex-1 rounded-[6px] bg-[#EF4444] px-2 py-1 text-xs font-bold text-white"
                  >
                    删除
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteConfirm(false)
                    }}
                    className="flex-1 rounded-[6px] border border-[#E5EAF2] px-2 py-1 text-xs text-[#6B7280]"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 标题（或编辑输入框） */}
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditConfirm()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            onBlur={handleEditConfirm}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs font-bold text-[#111827] line-clamp-2 leading-tight bg-white border border-[#2563EB] rounded px-1 py-0.5 outline-none"
            maxLength={15}
          />
        ) : (
          <div
            className="text-xs font-bold text-[#111827] line-clamp-2 leading-tight cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            title="双击编辑"
          >
            {node.title}
          </div>
        )}

        {/* 状态标签 */}
        <div
          className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: nodeStyle.statusBg, color: nodeStyle.statusColor }}
        >
          {nodeStyle.statusText}
        </div>

        {/* 底部：编号 + 来源标记 + 移动按钮 */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#6B7280]">第 {index} 步</span>
            {node.source === 'user' && (
              <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#2563EB]">
                自定义
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp()
              }}
              disabled={!canMoveUp}
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="上移"
            >
              ↑
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              disabled={!canMoveDown}
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="下移"
            >
              ↓
            </button>
          </div>
        </div>

        {/* 完成标记：仅第一个节点显示"当前"状态标记 */}
        {isFirstNode && (
          <div className="absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white text-xs font-bold">
            →
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 右侧建议栏 ============
interface SuggestionPanelProps {
  selectedNodeId: string | null
  suggestions?: Array<{ id: number; text: string; desc: string }>
  resources?: Array<{ id: number; title: string; tag: string; link?: string }>
  loading?: boolean
  phases: EditablePhase[]
}

function SuggestionPanel({
  selectedNodeId,
  suggestions = DEFAULT_SUGGESTIONS,
  resources = [],
  loading = false,
  phases,
}: SuggestionPanelProps) {
  const getPhaseInfo = () => {
    if (!selectedNodeId) return phases[1] || phases[0]
    for (const phase of phases) {
      if (phase.nodes.some((n) => n.id === selectedNodeId)) return phase
    }
    return phases[0]
  }

  const phase = getPhaseInfo()

  return (
    <div className="space-y-3">
      {/* 阶段说明卡片 */}
      <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: PHASE_COLORS[(phase.id - 1) as 0 | 1 | 2] }}
          >
            {phase.id}
          </div>
          <div>
            <div className="text-xs font-bold text-[#111827]">{phase.title}</div>
            <div className="text-xs text-[#6B7280]">{phase.description}</div>
          </div>
        </div>
      </div>

      {/* 路径建议面板 */}
      <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <TypewriterLoader text="AI 正在生成建议…" size="sm" />
          </div>
        ) : (
          <>
            {/* 补弱路径建议 */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#111827]">路径建议</h3>
              <div className="mt-3 space-y-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-[8px] border border-[#E5EAF2] bg-[#F9FAFB] p-2 hover:border-[#2563EB] transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-[#111827] line-clamp-2">
                      {suggestion.text}
                    </div>
                    <div className="mt-0.5 text-xs text-[#6B7280] line-clamp-1">
                      {suggestion.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 对应资源 */}
            <div>
              <h3 className="text-xs font-bold text-[#111827]">资源推送</h3>
              <div className="mt-3 space-y-2">
                {resources.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.link || '#'}
                    className="block rounded-[8px] border border-[#E5EAF2] bg-[#F9FAFB] p-2 hover:border-[#2563EB] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-xs font-bold text-[#111827] line-clamp-2 flex-1">
                        {resource.title}
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-xs font-bold text-[#2563EB] flex-shrink-0">
                        {resource.tag}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* 底部操作 */}
            <div className="mt-4 border-t border-[#E5EAF2] pt-3">
              <a
                href="/generate?view=library"
                className="block w-full text-xs font-bold text-[#2563EB] hover:text-[#1d4ed8] transition-colors text-center"
              >
                查看全部资源
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

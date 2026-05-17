'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'

// ============ 类型定义 ============
interface PathNode {
  id: number
  title: string
  status: 'completed' | 'current' | 'next' | 'locked'
  phase: 1 | 2 | 3
}

interface Phase {
  id: number
  title: string
  subtitle: string
  color: string
  description: string
  nodes: PathNode[]
}

// ============ 数据定义 ============
const DEFAULT_PHASES: Phase[] = [
  {
    id: 1,
    title: '补弱阶段',
    subtitle: '1 / 3',
    color: '#16A34A',
    description: '夯实基础',
    nodes: [
      { id: 1, title: '回看返回值短讲义', status: 'completed', phase: 1 },
      { id: 2, title: '补清作用域混淆', status: 'completed', phase: 1 },
      { id: 3, title: '做 5 题补弱练习', status: 'completed', phase: 1 },
      { id: 4, title: '阶段完成', status: 'completed', phase: 1 },
    ],
  },
  {
    id: 2,
    title: '达标阶段',
    subtitle: '2 / 3',
    color: '#2563EB',
    description: '能力达标',
    nodes: [
      { id: 5, title: '回顾函数定义', status: 'current', phase: 2 },
      { id: 6, title: '完成返回值理解', status: 'next', phase: 2 },
      { id: 7, title: '完成 8 题达标练习', status: 'next', phase: 2 },
      { id: 8, title: '进入模块导入', status: 'next', phase: 2 },
    ],
  },
  {
    id: 3,
    title: '目标阶段',
    subtitle: '3 / 3',
    color: '#94A3B8',
    description: '应用提升',
    nodes: [
      { id: 9, title: '进入模块导入', status: 'locked', phase: 3 },
      { id: 10, title: '学习文件读写', status: 'locked', phase: 3 },
      { id: 11, title: '完成成绩统计项目', status: 'locked', phase: 3 },
      { id: 12, title: '项目完成', status: 'locked', phase: 3 },
    ],
  },
]

const SUGGESTIONS = [
  { id: 1, text: '先补返回值，再补作用域', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 2, text: '资源 10 分钟 + 练习 5 题', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 3, text: '卡住就换一种讲法', desc: '根据当前画像、推荐和路径状态自动推荐。' },
]

const RESOURCES: Array<{ id: number; title: string; tag: string; link?: string }> = []

// ============ 主组件 ============
export default function PathPage() {
  const [targetInput, setTargetInput] = useState('我想自己写一个成绩统计程序')
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(5)
  const [generatedSuggestions, setGeneratedSuggestions] = useState(SUGGESTIONS)
  const [generatedResources, setGeneratedResources] = useState<Array<{ id: number; title: string; tag: string; link?: string }>>(RESOURCES)
  const [loading, setLoading] = useState(false)
  const [nodeLoading, setNodeLoading] = useState(false)
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)
  const requestSeqRef = useRef(0)

  // 加载真实资源作为资源推送
  useEffect(() => {
    api.getRecentResources().then(data => {
      const mapped = data.slice(0, 3).map((r, idx) => ({
        id: idx + 1,
        title: r.title,
        tag: r.type === 'document' ? '文档' : r.type === 'ppt' ? 'PPT' : r.type === 'mindmap' ? '思维导图' : r.type,
        link: `/generate?view=library&id=${r.id}`,
      }))
      if (mapped.length > 0) setGeneratedResources(mapped)
    }).catch(() => {})
  }, [])

  const handleNodeClick = async (nodeId: number | null) => {
    if (nodeId === null) return
    setSelectedNodeId(nodeId)

    const allNodes = phases.flatMap(p => p.nodes)
    const node = allNodes.find(n => n.id === nodeId)
    if (!node) return

    const phase = phases.find(p => p.nodes.some(n => n.id === nodeId))
    const goal = node.title

    // 防竞态：只处理最新一次请求
    const seq = ++requestSeqRef.current
    setNodeLoading(true)

    try {
      const resp = await api.getPathNodeSuggestions({
        nodeTitle: node.title,
        nodeGoal: goal,
        nodeStatus: node.status,
        phaseTitle: phase?.title || '当前阶段',
        target: targetInput,
      })

      // 如果已经有更新的请求，丢弃本次结果
      if (seq !== requestSeqRef.current) return

      if (resp.suggestions.length > 0) {
        setGeneratedSuggestions(resp.suggestions)
      }
      if (resp.resources.length > 0) {
        setGeneratedResources(resp.resources)
      }
    } catch (error) {
      console.error('Failed to get node suggestions:', error)
      if (seq !== requestSeqRef.current) return

      // 回退到静态建议
      setGeneratedSuggestions([
        { id: 1, text: `先学习 ${goal}`, desc: '根据当前节点自动推荐的学习路径。' },
        { id: 2, text: `完成 ${goal} 相关练习`, desc: '根据当前节点自动推荐的练习任务。' },
        { id: 3, text: `掌握 ${goal} 的核心概念`, desc: '根据当前节点自动推荐的学习重点。' },
      ])
      setGeneratedResources([
        { id: 1, title: `${goal}精讲讲义`, tag: '优先学习', link: `/generate?tab=library&type=lecture&goal=${encodeURIComponent(goal)}` },
        { id: 2, title: `${goal}补弱题练`, tag: '5题', link: `/practice?topic=${encodeURIComponent(goal)}` },
        { id: 3, title: `${goal}项目案例`, tag: '待复习', link: `/generate?tab=library&type=project&goal=${encodeURIComponent(goal)}` },
      ])
    } finally {
      if (seq === requestSeqRef.current) {
        setNodeLoading(false)
      }
    }
  }

  const handleRegeneratePath = async () => {
    setLoading(true)
    try {
      const data = await api.generatePathPlanning(targetInput)
      if (data) {
        // 更新建议和资源
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setGeneratedSuggestions(data.suggestions)
        }
        if (Array.isArray(data.resources) && data.resources.length > 0) {
          setGeneratedResources(data.resources)
        }

        // 更新路径回路节点
        const phases_data = data.phases
        if (Array.isArray(phases_data) && phases_data.length >= 2) {
          const PHASE_COLORS = ['#16A34A', '#2563EB', '#94A3B8']
          const PHASE_DESCS = ['夯实基础', '能力达标', '应用提升']
          const newPhases: Phase[] = phases_data.slice(0, 3).map((p: any, pIdx: number) => {
            const phaseId = (pIdx + 1) as 1 | 2 | 3
            const nodes: PathNode[] = (p.nodes || []).map((n: any, nIdx: number) => {
              let status: PathNode['status'] = 'locked'
              if (pIdx === 0 && nIdx === 0) status = 'current'
              else if (pIdx === 0) status = 'next'
              return {
                id: Number(n.id || (pIdx * 4 + nIdx + 1)),
                title: String(n.title || `步骤 ${nIdx + 1}`),
                status,
                phase: phaseId,
              }
            })
            return {
              id: phaseId,
              title: String(p.title || `阶段 ${phaseId}`),
              subtitle: `${phaseId} / 3`,
              color: PHASE_COLORS[pIdx],
              description: String(p.description || PHASE_DESCS[pIdx]),
              nodes,
            }
          })
          setPhases(newPhases)
          if (newPhases[0]?.nodes[0]) {
            setSelectedNodeId(newPhases[0].nodes[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate path planning:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 页面标题区 */}
      <PageHeader />

      {/* 统一容器 - 确保摘要条和下面的模块宽度一致 */}
      <div>
        {/* 摘要条 */}
        <SummaryBar />

        {/* 主体区域：左右两栏 */}
        <div className="mt-6 grid grid-cols-[1fr_320px] gap-2 max-[980px]:grid-cols-1">
          {/* 左侧：阶段路径回路 */}
          <PathCircuitCard
            targetInput={targetInput}
            setTargetInput={setTargetInput}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={handleNodeClick}
            onRegeneratePath={handleRegeneratePath}
            loading={loading}
            phases={phases}
          />

          {/* 右侧：建议栏 */}
          <SuggestionPanel 
            selectedNodeId={selectedNodeId} 
            suggestions={generatedSuggestions}
            resources={generatedResources}
            loading={nodeLoading}
            phases={phases}
          />
        </div>
      </div>
    </>
  )
}

function PageHeader() {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-[#2563EB]">学习路径 / 你现在要走的下一步</div>
      <h1 className="mt-2 text-3xl font-bold text-[#111827]">个性化学习路径</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        这一页只保留当前阶段、完成标准和下一步入口，不再堆系统解释。
      </p>
    </div>
  )
}

// ============ 摘要条 ============
function SummaryBar() {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
      <div className="grid grid-cols-5 gap-px max-[1080px]:grid-cols-3 max-[760px]:grid-cols-2 max-[760px]:gap-4">
        {/* 当前目标 */}
        <div className="border-r border-[#E5EAF2] pr-6">
          <div className="text-xs text-[#6B7280]">当前目标</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">Python 函数与模块</div>
        </div>

        {/* 路径进度 */}
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

        {/* 当前阶段 */}
        <div className="border-r border-[#E5EAF2] px-6">
          <div className="text-xs text-[#6B7280]">当前阶段</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">达标阶段</div>
          <div className="text-xs text-[#6B7280]">第 2 / 3 阶段</div>
        </div>

        {/* 当前重点 */}
        <div className="border-r border-[#E5EAF2] px-6">
          <div className="text-xs text-[#6B7280]">当前重点</div>
          <div className="mt-2 text-sm font-bold text-[#111827]">先补返回值</div>
          <div className="text-xs text-[#6B7280]">通过后再进模块导入</div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2 pl-6">
          <Link href="/path" className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors text-center">
            开始今日路径
          </Link>
          <button onClick={() => document.querySelector<HTMLInputElement>('[data-target-input]')?.focus()} className="rounded-[10px] border border-[#E5EAF2] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:border-[#2563EB] transition-colors">
            调整目标
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ 阶段路径回路卡片 ============
interface PathCircuitCardProps {
  targetInput: string
  setTargetInput: (value: string) => void
  selectedNodeId: number | null
  setSelectedNodeId: (id: number | null) => void
  onRegeneratePath: () => void
  loading: boolean
  phases: Phase[]
}

function PathCircuitCard({
  targetInput,
  setTargetInput,
  selectedNodeId,
  setSelectedNodeId,
  onRegeneratePath,
  loading,
  phases,
}: PathCircuitCardProps) {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
      {/* 标题 + 目标设定 */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-[#111827]">阶段路径回路</h2>
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
      <PathCanvas selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} phases={phases} />

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
        <Link href="/generate" className="rounded-[10px] bg-[#2563EB] px-6 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors">
          学习当前节点资源
        </Link>
        <Link href="/practice" className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-2 text-sm font-bold text-[#2563EB] hover:border-[#2563EB] transition-colors">
          进入当前节点练习
        </Link>
        <Link href="/generate" className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-2 text-sm font-bold text-[#111827] hover:border-[#E5EAF2] transition-colors">
          生成补弱资源
        </Link>
      </div>
    </div>
  )
}

// ============ 路径图画布 ============
interface PathCanvasProps {
  selectedNodeId: number | null
  setSelectedNodeId: (id: number | null) => void
  phases: Phase[]
}

function PathCanvas({ selectedNodeId, setSelectedNodeId, phases }: PathCanvasProps) {
  const nodeWidth = 168
  const nodeHeight = 72
  const nodeGap = 16
  const stageLeftWidth = 120
  const stageGap = 24

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <PhaseStrip
          key={phase.id}
          phase={phase}
          stageLeftWidth={stageLeftWidth}
          nodeWidth={nodeWidth}
          nodeHeight={nodeHeight}
          nodeGap={nodeGap}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
        />
      ))}
    </div>
  )
}

// ============ 阶段条 ============
interface PhaseStripProps {
  phase: Phase
  stageLeftWidth: number
  nodeWidth: number
  nodeHeight: number
  nodeGap: number
  selectedNodeId: number | null
  setSelectedNodeId: (id: number | null) => void
}

function PhaseStrip({
  phase,
  stageLeftWidth,
  nodeWidth,
  nodeHeight,
  nodeGap,
  selectedNodeId,
  setSelectedNodeId,
}: PhaseStripProps) {
  return (
    <div className="flex gap-4 items-start">
      {/* 右侧节点行 */}
      <div className="flex-1 flex gap-4 items-center overflow-x-auto pb-2">
        {phase.nodes.map((node, idx) => (
          <div key={node.id} className="flex items-center gap-4 flex-shrink-0">
            {/* 节点 */}
            <PathNode
              node={node}
              isSelected={selectedNodeId === node.id}
              onClick={() => setSelectedNodeId(node.id)}
              width={nodeWidth}
              height={nodeHeight}
            />

            {/* 节点之间的连接箭头 */}
            {idx < phase.nodes.length - 1 && (
              <div className="flex-shrink-0 text-[#111827] text-lg font-bold">
                →
              </div>
            )}

            {/* 最后一个节点显示旗子 */}
            {idx === phase.nodes.length - 1 && (
              <div className="flex-shrink-0 text-2xl">
                🚩
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ 路径节点 ============
interface PathNodeProps {
  node: PathNode
  isSelected: boolean
  onClick: () => void
  width?: number
  height?: number
}

function PathNode({ node, isSelected, onClick, width = 150, height = 72 }: PathNodeProps) {
  const getNodeStyle = () => {
    switch (node.status) {
      case 'completed':
        return {
          border: '1px solid #86EFAC',
          background: '#F0FDF4',
          statusBg: '#DCFCE7',
          statusColor: '#16A34A',
          statusText: '已完成',
        }
      case 'current':
        return {
          border: '2px solid #2563EB',
          background: '#F8FAFF',
          statusBg: '#DBEAFE',
          statusColor: '#2563EB',
          statusText: '当前推荐',
          shadow: '0 8px 20px rgba(37, 99, 235, 0.12)',
        }
      case 'next':
        return {
          border: '1px solid #BFDBFE',
          background: '#FFFFFF',
          statusBg: '#EFF6FF',
          statusColor: '#2563EB',
          statusText: '下一步',
        }
      case 'locked':
        return {
          border: '1px solid #E5EAF2',
          background: '#FFFFFF',
          statusBg: '#F3F4F6',
          statusColor: '#94A3B8',
          statusText: '未开始',
        }
    }
  }

  const style = getNodeStyle()

  // 简化的目标描述 - 直接使用节点标题（支持动态生成的节点）
  const getSimplifiedGoal = () => {
    return node.title
  }

  return (
    <button
      onClick={onClick}
      className="relative rounded-[12px] p-3 text-left transition-all hover:shadow-md flex flex-col justify-between"
      style={{
        border: style.border,
        background: style.background,
        boxShadow: isSelected && node.status === 'current' ? style.shadow || 'none' : 'none',
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
      }}
    >
      {/* 简化的目标描述 - 主要展示 */}
      <div className="text-xs font-bold text-[#111827] line-clamp-2 leading-tight">
        {getSimplifiedGoal()}
      </div>

      {/* 节点编号 - 次要展示 */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[#6B7280]">第 {node.id} 步</span>
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white flex-shrink-0">
          →
        </div>
      </div>

      {/* 完成标记 */}
      {node.status === 'completed' && (
        <div className="absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A] text-white text-xs font-bold">
          ✓
        </div>
      )}
    </button>
  )
}

// ============ 右侧建议栏 ============
interface SuggestionPanelProps {
  selectedNodeId: number | null
  suggestions?: Array<{ id: number; text: string; desc: string }>
  resources?: Array<{ id: number; title: string; tag: string; link?: string }>
  loading?: boolean
  phases: Phase[]
}

function SuggestionPanel({ selectedNodeId, suggestions = SUGGESTIONS, resources = RESOURCES, loading = false, phases }: SuggestionPanelProps) {
  // 根据选中的节点获取对应的阶段信息
  const getPhaseInfo = () => {
    if (!selectedNodeId) return phases[1] || DEFAULT_PHASES[1]
    
    const node = phases.flatMap(p => p.nodes).find(n => n.id === selectedNodeId)
    if (!node) return phases[1] || DEFAULT_PHASES[1]
    
    return phases.find(p => p.id === node.phase) || phases[1] || DEFAULT_PHASES[1]
  }
  
  const phase = getPhaseInfo()

  return (
    <div className="space-y-3">
      {/* 阶段说明卡片 */}
      <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: phase.color }}
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
                <div className="text-xs font-bold text-[#111827] line-clamp-2">{suggestion.text}</div>
                <div className="mt-0.5 text-xs text-[#6B7280] line-clamp-1">{suggestion.desc}</div>
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
                  <div className="text-xs font-bold text-[#111827] line-clamp-2 flex-1">{resource.title}</div>
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
          <a href="/generate?view=library" className="block w-full text-xs font-bold text-[#2563EB] hover:text-[#1d4ed8] transition-colors text-center">
            查看全部资源
          </a>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

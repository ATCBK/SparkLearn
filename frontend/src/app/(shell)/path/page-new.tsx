'use client'

import { useState } from 'react'
import { ChevronRight, Zap } from 'lucide-react'

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
const PHASES: Phase[] = [
  {
    id: 1,
    title: '补弱阶段',
    subtitle: '1 / 3',
    color: '#16A34A',
    description: '夯实基础，3 个任务',
    nodes: [
      { id: 1, title: '回看返回值短讲义', status: 'completed', phase: 1 },
      { id: 2, title: '补清作用域混淆', status: 'completed', phase: 1 },
      { id: 3, title: '做 5 题补弱练习', status: 'completed', phase: 1 },
    ],
  },
  {
    id: 2,
    title: '达标阶段',
    subtitle: '2 / 3',
    color: '#2563EB',
    description: '能力达标，4 个任务',
    nodes: [
      { id: 4, title: '回顾函数定义', status: 'current', phase: 2 },
      { id: 5, title: '完成返回值理解', status: 'next', phase: 2 },
      { id: 6, title: '完成 8 题达标练习', status: 'next', phase: 2 },
      { id: 7, title: '进入模块导入', status: 'next', phase: 2 },
    ],
  },
  {
    id: 3,
    title: '目标阶段',
    subtitle: '3 / 3',
    color: '#94A3B8',
    description: '应用提升，3 个任务',
    nodes: [
      { id: 8, title: '进入模块导入', status: 'locked', phase: 3 },
      { id: 9, title: '学习文件读写', status: 'locked', phase: 3 },
      { id: 10, title: '完成成绩统计项目', status: 'locked', phase: 3 },
    ],
  },
]

const SUGGESTIONS = [
  { id: 1, text: '先补返回值，再补作用域', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 2, text: '资源 10 分钟 + 练习 5 题', desc: '根据当前画像、推荐和路径状态自动推荐。' },
  { id: 3, text: '卡住就换一种讲法', desc: '根据当前画像、推荐和路径状态自动推荐。' },
]

const RESOURCES = [
  { id: 1, title: '函数返回值项目讲义', tag: '优先学习' },
  { id: 2, title: '函数作用域精讲讲义', tag: '待复习' },
  { id: 3, title: '返回值补弱题练', tag: '5 题' },
]

// ============ 主组件 ============
export default function PathPage() {
  const [targetInput, setTargetInput] = useState('我想自己写一个成绩统计程序')
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(4)

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      {/* 顶部栏 */}
      <TopBar />

      {/* 主内容区 */}
      <div className="ml-[220px] pt-[56px]">
        <div className="mx-auto max-w-[1360px] px-8 py-8">
          {/* 页面标题区 */}
          <PageHeader />

          {/* 摘要条 */}
          <SummaryBar />

          {/* 主体区域：左右两栏 */}
          <div className="mt-6 grid grid-cols-[1fr_320px] gap-5">
            {/* 左侧：阶段路径回路 */}
            <PathCircuitCard
              targetInput={targetInput}
              setTargetInput={setTargetInput}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />

            {/* 右侧：建议栏 */}
            <SuggestionPanel selectedNodeId={selectedNodeId} />
          </div>
        </div>
      </div>

      {/* AI 悬浮按钮 */}
      <AIFloatingButton />
    </div>
  )
}

// ============ 顶部栏 ============
function TopBar() {
  return (
    <div className="fixed left-0 right-0 top-0 z-10 h-14 border-b border-[#E5EAF2] bg-white">
      <div className="flex h-full items-center justify-between px-8">
        <div className="text-sm font-bold text-[#6B7280]">
          SparkLearn / <span className="text-[#111827]">个性化路径</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
            李
          </div>
          <span className="text-sm font-bold text-[#111827]">李明</span>
        </div>
      </div>
    </div>
  )
}

// ============ 页面标题区 ============
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
      <div className="grid grid-cols-5 gap-px">
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
          <button className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors">
            开始今日路径
          </button>
          <button className="rounded-[10px] border border-[#E5EAF2] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:border-[#2563EB] transition-colors">
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
}

function PathCircuitCard({
  targetInput,
  setTargetInput,
  selectedNodeId,
  setSelectedNodeId,
}: PathCircuitCardProps) {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
      {/* 标题 + 目标设定 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#111827]">阶段路径回路</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="输入目标，AI 会重排路径…"
            className="h-9 w-64 rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB] px-3 text-sm outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />
          <button className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors whitespace-nowrap">
            生成路径
          </button>
        </div>
      </div>

      {/* 路径图画布 */}
      <PathCanvas selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} />

      {/* 图例 */}
      <div className="mt-6 flex gap-6 text-xs font-bold">
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
      <div className="mt-6 flex gap-3">
        <button className="rounded-[10px] bg-[#2563EB] px-6 py-3 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors">
          学习当前节点资源
        </button>
        <button className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-3 text-sm font-bold text-[#2563EB] hover:border-[#2563EB] transition-colors">
          进入当前节点练习
        </button>
        <button className="rounded-[10px] border border-[#E5EAF2] bg-white px-6 py-3 text-sm font-bold text-[#111827] hover:border-[#E5EAF2] transition-colors">
          生成补弱资源
        </button>
      </div>
    </div>
  )
}

// ============ 路径图画布 ============
interface PathCanvasProps {
  selectedNodeId: number | null
  setSelectedNodeId: (id: number | null) => void
}

function PathCanvas({ selectedNodeId, setSelectedNodeId }: PathCanvasProps) {
  return (
    <div
      className="relative rounded-[12px] border border-[#E5EAF2] bg-[#FAFCFF] p-6"
      style={{
        backgroundImage:
          'linear-gradient(#EEF2F7 1px, transparent 1px), linear-gradient(90deg, #EEF2F7 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        minHeight: '430px',
      }}
    >
      {/* 第一阶段 - 补弱 */}
      <PhaseRow
        phase={PHASES[0]}
        top={48}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
      />

      {/* 第一阶段到第二阶段的转弯线 */}
      <TurnLine top={48 + 72 + 24} left={130 + 150 * 3 + 20} color="#16A34A" />

      {/* 第二阶段 - 达标 */}
      <PhaseRow
        phase={PHASES[1]}
        top={180}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
      />

      {/* 第二阶段到第三阶段的转弯线 */}
      <TurnLine top={180 + 72 + 24} left={130 + 150 * 4 + 20} color="#2563EB" />

      {/* 第三阶段 - 目标 */}
      <PhaseRow
        phase={PHASES[2]}
        top={310}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
      />

      {/* 结束标记 */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: 130 + 150 * 3 + 20,
          top: 310 + 72 + 24,
          width: 32,
          height: 32,
        }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#94A3B8] bg-white text-[#94A3B8]">
          🚩
        </div>
      </div>
    </div>
  )
}

// ============ 阶段行 ============
interface PhaseRowProps {
  phase: Phase
  top: number
  selectedNodeId: number | null
  setSelectedNodeId: (id: number | null) => void
}

function PhaseRow({ phase, top, selectedNodeId, setSelectedNodeId }: PhaseRowProps) {
  return (
    <div className="absolute" style={{ top, left: 0, right: 0 }}>
      {/* 阶段标识 */}
      <div className="absolute left-0 top-0 w-[130px]">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: phase.color }}
        >
          {phase.id}
        </div>
        <div className="mt-2 text-sm font-bold text-[#111827]">{phase.title}</div>
        <div className="text-xs text-[#6B7280]">{phase.description}</div>
      </div>

      {/* 节点容器 */}
      <div className="relative ml-[130px] flex gap-5">
        {phase.nodes.map((node, idx) => (
          <div key={node.id} className="relative">
            {/* 节点 */}
            <PathNode
              node={node}
              isSelected={selectedNodeId === node.id}
              onClick={() => setSelectedNodeId(node.id)}
            />

            {/* 节点之间的连接线 */}
            {idx < phase.nodes.length - 1 && (
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: '100%',
                  width: 20,
                  height: 3,
                  backgroundColor: phase.color,
                  borderRadius: '999px',
                }}
              />
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
}

function PathNode({ node, isSelected, onClick }: PathNodeProps) {
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
          border: '1px solid #2563EB',
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

  return (
    <button
      onClick={onClick}
      className="relative w-[150px] rounded-[12px] p-3 text-left transition-all hover:shadow-md"
      style={{
        border: style.border,
        background: style.background,
        boxShadow: isSelected ? style.shadow || 'none' : 'none',
        minHeight: '72px',
      }}
    >
      {/* 节点编号 */}
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
        {node.id}
      </div>

      {/* 节点标题 */}
      <div className="mt-2 text-xs font-bold text-[#111827] line-clamp-2">{node.title}</div>

      {/* 状态标签 */}
      <div
        className="absolute bottom-2 right-2 rounded-full px-2 py-1 text-xs font-bold"
        style={{
          backgroundColor: style.statusBg,
          color: style.statusColor,
        }}
      >
        {style.statusText}
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

// ============ 转弯线 ============
interface TurnLineProps {
  top: number
  left: number
  color: string
}

function TurnLine({ top, left, color }: TurnLineProps) {
  return (
    <div
      className="absolute"
      style={{
        top,
        left,
        width: 64,
        height: 96,
        border: `3px solid ${color}`,
        borderLeft: 'none',
        borderRadius: '0 32px 32px 0',
      }}
    />
  )
}

// ============ 右侧建议栏 ============
interface SuggestionPanelProps {
  selectedNodeId: number | null
}

function SuggestionPanel({ selectedNodeId }: SuggestionPanelProps) {
  return (
    <div className="rounded-[14px] border border-[#E5EAF2] bg-white p-6 shadow-sm">
      {/* 补弱路径建议 */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-[#111827]">补弱路径建议</h3>
        <div className="mt-4 space-y-3">
          {SUGGESTIONS.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB] p-3 hover:border-[#2563EB] transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-[#111827]">{suggestion.text}</div>
              <div className="mt-1 text-xs text-[#6B7280]">{suggestion.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 对应资源 */}
      <div>
        <h3 className="text-sm font-bold text-[#111827]">对应资源</h3>
        <div className="mt-4 space-y-3">
          {RESOURCES.map((resource) => (
            <div
              key={resource.id}
              className="rounded-[10px] border border-[#E5EAF2] bg-[#F9FAFB] p-3 hover:border-[#2563EB] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-[#111827]">{resource.title}</div>
                <span className="whitespace-nowrap rounded-full bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">
                  {resource.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="mt-6 space-y-2 border-t border-[#E5EAF2] pt-4">
        <button className="w-full text-xs font-bold text-[#2563EB] hover:text-[#1d4ed8] transition-colors">
          查看全部资源
        </button>
        <button className="w-full text-xs font-bold text-[#2563EB] hover:text-[#1d4ed8] transition-colors">
          让 AI 推荐先走哪条
        </button>
      </div>
    </div>
  )
}

// ============ AI 悬浮按钮 ============
function AIFloatingButton() {
  return (
    <button className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg hover:bg-[#1d4ed8] transition-colors">
      <Zap className="h-6 w-6" />
    </button>
  )
}

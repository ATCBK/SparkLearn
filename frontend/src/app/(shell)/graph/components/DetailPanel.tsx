// 知识图谱详情面板组件
'use client'

import { BookOpen, Clock, Target, CheckCircle2, Sparkles, Loader2, Play, FileText, Brain } from 'lucide-react'
import { useGraphStore } from '../store/graphStore'
import { ProtoCard, SoftCard, Bar, Pill, ProtoButton } from '@/components/proto'
import type { NodeRelation } from '../types/graph'

/** 节点状态颜色映射 */
const STATUS_COLORS = {
  mastered: { bar: 'green' as const, pill: 'green' as const, bg: 'bg-green-light', text: 'text-green', label: '已掌握' },
  learning: { bar: 'blue' as const, pill: 'blue' as const, bg: 'bg-blue-light', text: 'text-blue', label: '学习中' },
  not_started: { bar: 'orange' as const, pill: 'orange' as const, bg: 'bg-orange-light', text: 'text-orange', label: '未学习' },
  locked: { bar: 'orange' as const, pill: 'neutral' as const, bg: 'bg-[#f3f4f6]', text: 'text-soft', label: '未解锁' },
}

/** 难度星级渲染 */
function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < level ? 'text-warning' : 'text-[#E5EAF2]'}
        >
          ★
        </span>
      ))}
    </span>
  )
}

/** 关联知识点列表项 */
function RelationItem({ relation }: { relation: NodeRelation }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-[#eef2f7] bg-[#f9fafb] px-3 py-2 hover:border-blue transition-colors">
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[relation.status as keyof typeof STATUS_COLORS]?.text === 'text-green' ? '#16A34A' : relation.status === 'learning' ? '#2563EB' : '#D1D5DB' }}
      />
      <span className="flex-1 text-small font-bold text-ink truncate">{relation.name}</span>
      <span className="text-micro text-muted">{relation.mastery}%</span>
    </div>
  )
}

/** 默认图例+概览面板 */
function OverviewPanel() {
  const graphData = useGraphStore((s) => s.graphData)
  const stats = graphData?.stats

  return (
    <div className="space-y-4">
      {/* 图例 */}
      <ProtoCard>
        <h3 className="mb-3 text-h3 font-bold text-ink">图例说明</h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-green" />
            <span className="text-small text-ink">已掌握 (≥80%)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-blue" />
            <span className="text-small text-ink">学习中 (40-79%)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-orange" />
            <span className="text-small text-ink">未学习 (1-39%)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-3 rounded-full bg-[#D1D5DB]" />
            <span className="text-small text-ink">未解锁 (0%)</span>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <h4 className="mb-2 text-small font-bold text-ink">连线说明</h4>
          <div className="flex items-center gap-2.5">
            <div className="h-0 w-8 border-t-2 border-[#CBD5E1]" />
            <span className="text-small text-muted">前置依赖</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-0 w-8 border-t-2 border-dashed border-[#93C5FD]" />
            <span className="text-small text-muted">推荐关联</span>
          </div>
        </div>
      </ProtoCard>

      {/* 统计概览 */}
      {stats && (
        <ProtoCard>
          <h3 className="mb-3 text-h3 font-bold text-ink">学习统计</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-small text-muted">已掌握</span>
                <span className="text-small font-bold text-green">{stats.mastered} / {stats.total}</span>
              </div>
              <Bar value={(stats.mastered / stats.total) * 100} tone="green" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-small text-muted">学习中</span>
                <span className="text-small font-bold text-blue">{stats.learning} / {stats.total}</span>
              </div>
              <Bar value={(stats.learning / stats.total) * 100} tone="blue" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-small text-muted">未学习</span>
                <span className="text-small font-bold text-orange">{stats.not_started} / {stats.total}</span>
              </div>
              <Bar value={(stats.not_started / stats.total) * 100} tone="orange" />
            </div>
          </div>
        </ProtoCard>
      )}

      {/* 操作提示 */}
      <SoftCard>
        <p className="text-small text-muted leading-6">
          点击图谱中的节点可查看该知识点的详细学习数据和 AI 个性化建议。
          拖拽可调整节点位置，滚轮可缩放图谱。
        </p>
      </SoftCard>
    </div>
  )
}

/** 选中节点详情面板 */
function NodeDetailPanel() {
  const nodeDetail = useGraphStore((s) => s.nodeDetail)
  const isDetailLoading = useGraphStore((s) => s.isDetailLoading)

  if (isDetailLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue" />
          <p className="text-small text-muted">加载详情中...</p>
        </div>
      </div>
    )
  }

  if (!nodeDetail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-small text-muted">无法加载节点详情</p>
      </div>
    )
  }

  const { node, prerequisites, successors, ai_suggestion } = nodeDetail
  const { user_status: status } = node
  const statusStyle = STATUS_COLORS[status.status] || STATUS_COLORS.locked

  return (
    <div className="space-y-3">
      {/* 节点头部信息 */}
      <ProtoCard>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-h2 font-bold text-ink leading-tight">{node.name}</h3>
          <Pill tone={statusStyle.pill}>{statusStyle.label}</Pill>
        </div>
        <div className="mb-3 flex items-center gap-3 text-micro text-muted">
          <span>{node.category}</span>
          <span>难度：<DifficultyStars level={node.difficulty} /></span>
        </div>
        <p className="text-small text-muted leading-6">{node.description}</p>
      </ProtoCard>

      {/* 掌握度进度 */}
      <ProtoCard>
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-blue" />
          <h4 className="text-h3 font-bold text-ink">掌握度</h4>
        </div>
        <div className="mb-2 flex items-end justify-between">
          <span className="text-[28px] font-bold leading-none text-ink">{status.mastery}%</span>
          <span className="text-micro text-muted">目标：100%</span>
        </div>
        <Bar value={status.mastery} tone={statusStyle.bar} />
      </ProtoCard>

      {/* 学习数据 */}
      <ProtoCard>
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue" />
          <h4 className="text-h3 font-bold text-ink">学习数据</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SoftCard>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-muted" />
              <span className="text-micro text-muted">学习时长</span>
            </div>
            <b className="text-body text-ink">{status.study_hours}h</b>
          </SoftCard>
          <SoftCard>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3.5 w-3.5 text-muted" />
              <span className="text-micro text-muted">做题数</span>
            </div>
            <b className="text-body text-ink">{status.exercises_done}</b>
          </SoftCard>
          <SoftCard>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted" />
              <span className="text-micro text-muted">正确数</span>
            </div>
            <b className="text-body text-ink">{status.exercises_correct}</b>
          </SoftCard>
          <SoftCard>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-3.5 w-3.5 text-muted" />
              <span className="text-micro text-muted">正确率</span>
            </div>
            <b className="text-body text-ink">{status.accuracy}%</b>
          </SoftCard>
        </div>
        {status.last_studied && (
          <p className="mt-2 text-micro text-soft">最近学习：{status.last_studied}</p>
        )}
      </ProtoCard>

      {/* 前置知识 */}
      {prerequisites.length > 0 && (
        <ProtoCard>
          <h4 className="mb-2.5 text-h3 font-bold text-ink">前置知识</h4>
          <div className="space-y-1.5">
            {prerequisites.map((pre) => (
              <RelationItem key={pre.id} relation={pre} />
            ))}
          </div>
        </ProtoCard>
      )}

      {/* 后续知识 */}
      {successors.length > 0 && (
        <ProtoCard>
          <h4 className="mb-2.5 text-h3 font-bold text-ink">后续知识</h4>
          <div className="space-y-1.5">
            {successors.map((suc) => (
              <RelationItem key={suc.id} relation={suc} />
            ))}
          </div>
        </ProtoCard>
      )}

      {/* AI 建议 */}
      <ProtoCard className="border-blue/20 bg-blue-light/30">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue" />
          <h4 className="text-h3 font-bold text-blue">AI 建议</h4>
        </div>
        <p className="text-small text-ink leading-6">{ai_suggestion}</p>
      </ProtoCard>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <ProtoButton variant="primary" href="/generate" className="flex-1">
          <Play className="h-3.5 w-3.5" />
          开始学习
        </ProtoButton>
        <ProtoButton variant="secondary" href="/practice" className="flex-1">
          <Brain className="h-3.5 w-3.5" />
          做练习
        </ProtoButton>
      </div>
    </div>
  )
}

/** 详情面板入口 */
export function DetailPanel() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)

  return (
    <div className="h-full overflow-y-auto pr-1">
      {selectedNodeId ? <NodeDetailPanel /> : <OverviewPanel />}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api, LearningPath, PathNodeAdvice } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/ui/ErrorState'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'
import { Brain, Sparkles, X, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type NodePos = { x: number; y: number }

type DragState = {
  dragging: boolean
  startX: number
  startY: number
  originX: number
  originY: number
}

const MIN_ZOOM = 0.6
const MAX_ZOOM = 1.8

export default function PathPage() {
  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [advice, setAdvice] = useState<PathNodeAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<DragState>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const viewportRef = useRef<HTMLDivElement | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getLearningPath()
      setPath(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const graphLayout = useMemo(() => {
    const nodes = path?.knowledgeGraph?.nodes || []
    const edges = path?.knowledgeGraph?.edges || []
    const stages = path?.stages || []

    const stageIndexMap = new Map<string, number>()
    stages.forEach((s, i) => stageIndexMap.set(s.name, i))

    const grouped = new Map<string, typeof nodes>()
    nodes.forEach((n) => {
      if (!grouped.has(n.stage)) grouped.set(n.stage, [])
      grouped.get(n.stage)!.push(n)
    })

    grouped.forEach((arr) => arr.sort((a, b) => a.id.localeCompare(b.id, 'zh-CN')))

    const posMap = new Map<string, NodePos>()
    const stageGap = 260
    const rowGap = 118
    const startX = 140
    const startY = 140

    let maxRows = 1
    stages.forEach((s) => {
      const arr = grouped.get(s.name) || []
      maxRows = Math.max(maxRows, arr.length)
      arr.forEach((node, idx) => {
        const stageIdx = stageIndexMap.get(s.name) ?? 0
        const jitter = idx % 2 === 0 ? -10 : 12
        posMap.set(node.id, {
          x: startX + stageIdx * stageGap + (idx % 3) * 10,
          y: startY + idx * rowGap + jitter,
        })
      })
    })

    const width = Math.max(1050, startX + Math.max(1, stages.length - 1) * stageGap + 260)
    const height = Math.max(700, startY + (maxRows - 1) * rowGap + 220)

    return { nodes, edges, stages, posMap, width, height }
  }, [path])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp || !graphLayout.width || !graphLayout.height) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    if (vw <= 0 || vh <= 0) return

    const padding = 90
    const fit = Math.min((vw - padding) / graphLayout.width, (vh - padding) / graphLayout.height, 1)
    const nextZoom = clampZoom(fit)
    const nextPan = {
      x: (vw - graphLayout.width * nextZoom) / 2,
      y: (vh - graphLayout.height * nextZoom) / 2,
    }
    setZoom(nextZoom)
    setPan(nextPan)
  }, [graphLayout.width, graphLayout.height])

  async function handleNodeClick(nodeId: string) {
    setSelectedNodeId(nodeId)
    setAdvice(null)
    setAdviceError(null)
    try {
      setAdviceLoading(true)
      const data = await api.getLearningPathNodeAdvice(nodeId)
      setAdvice(data)
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : '获取建议失败')
    } finally {
      setAdviceLoading(false)
    }
  }

  function clampZoom(v: number) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v))
  }

  function resetViewport() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function zoomIn() {
    setZoom((z) => clampZoom(z + 0.1))
  }

  function zoomOut() {
    setZoom((z) => clampZoom(z - 0.1))
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom((z) => clampZoom(z + delta))
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    setDrag({
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    })
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!drag.dragging) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setPan({ x: drag.originX + dx, y: drag.originY + dy })
  }

  function onMouseUp() {
    if (!drag.dragging) return
    setDrag((prev) => ({ ...prev, dragging: false }))
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <TypewriterLoader text="正在加载知识图谱..." />
      </div>
    )
  }

  if (error) return <ErrorState type="server" onRetry={fetchData} />
  if (!path) return null

  return (
    <div className="h-screen bg-bg-card overflow-hidden flex "
      style={{
        backgroundImage: "url('/blue-gradient-background-clean.png'), linear-gradient(135deg, #f8fbff 0%, #eef5ff 52%, #e1ecff 100%)",
        backgroundSize: '100%  100%',
      }}
    >
      <aside className="w-[280px] h-80 border-r border-black/[0.06] bg-white/20 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="mb-4">
          <h1 className="text-h2 text-ink">学习路径图谱</h1>
          <p className="text-small text-ink-secondary mt-1">掌握度驱动的动态学习路径</p>
        </div>

        <div className="space-y-2">
          {path.stages.map((stage) => (
            <div
              key={stage.name}
              className={cn(
                'px-3 py-2 rounded-lg border text-small',
                stage.status === 'completed' && 'border-success/30 bg-success/10 text-success',
                stage.status === 'current' && 'border-blue/30 bg-blue-light text-blue',
                stage.status === 'pending' && 'border-black/[0.06] bg-bg-hover text-ink-secondary',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{stage.name}</span>
                {stage.status === 'current' && <Badge variant="info" size="sm">当前</Badge>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 text-micro text-ink-tertiary">
          <p className="font-semibold text-ink-secondary">操作</p>
          <p>拖动画布可平移；滚轮可缩放。</p>
          <p>点击节点查看 AI 学习建议。</p>
        </div>
      </aside>

      <main className="flex-1 h-full min-w-0 relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/90 border border-black/[0.08] rounded-[12px] p-2 shadow-sm">
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center" onClick={zoomOut} title="缩小">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-ink-secondary min-w-[44px] text-center">{Math.round(zoom * 100)}%</span>
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center" onClick={zoomIn} title="放大">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center" onClick={resetViewport} title="重置视图">
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-ink-tertiary"><Move className="w-4 h-4" /></span>
        </div>

        <div
          ref={viewportRef}
          className={cn('w-full h-full overflow-hidden select-none', drag.dragging ? 'cursor-grabbing' : 'cursor-grab')}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div
            className="relative"
            style={{
              width: `${graphLayout.width}px`,
              height: `${graphLayout.height}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="absolute inset-0" width={graphLayout.width} height={graphLayout.height} viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}>
              {graphLayout.edges.map((edge, idx) => {
                const s = graphLayout.posMap.get(edge.source)
                const t = graphLayout.posMap.get(edge.target)
                if (!s || !t) return null
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${idx}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="#c8d7f5"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>

            {graphLayout.stages.map((stage, idx) => (
              <div
                key={stage.name}
                className="absolute text-xs font-semibold text-ink-secondary bg-white/85 px-2 py-1 rounded border border-black/[0.05]"
                style={{ left: `${90 + idx * 260}px`, top: '28px' }}
              >
                {stage.name}
              </div>
            ))}

            {graphLayout.nodes.map((node) => {
              const pos = graphLayout.posMap.get(node.id)
              if (!pos) return null
              const masteryPct = Math.round((node.mastery || 0) * 100)
              const isSelected = selectedNodeId === node.id
              const tone = node.status === 'completed' ? 'success' : node.status === 'current' ? 'blue' : 'default'

              return (
                <button
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleNodeClick(node.id)
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                >
                  <div
                    className={cn(
                      'w-[72px] h-[72px] rounded-full border-2 shadow-[0_10px_26px_rgba(4,14,32,0.12)] flex items-center justify-center text-[12px] font-semibold transition-all',
                      tone === 'success' && 'border-success bg-success/10 text-success',
                      tone === 'blue' && 'border-blue bg-blue-light text-blue',
                      tone === 'default' && 'border-black/[0.08] bg-white text-ink-secondary',
                      isSelected && 'scale-110 ring-4 ring-blue/15',
                    )}
                  >
                    {masteryPct}%
                  </div>
                  <p className={cn('mt-2 w-[136px] text-xs text-center leading-4', isSelected ? 'text-blue font-medium' : 'text-ink')}>
                    {node.name}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </main>

      {selectedNodeId && (
        <div className="fixed right-8 top-24 w-[460px] z-40">
          <Card className="p-5 shadow-[0_20px_40px_rgba(4,14,32,0.18)] border-blue/20 max-h-[78vh] overflow-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-blue">
                  <Brain className="w-4 h-4" />
                  <p className="text-small font-semibold">AI 个性化建议</p>
                </div>
                <p className="text-caption text-ink-tertiary mt-1">基于画像 + 掌握度 + 先修依赖生成</p>
              </div>
              <button className="text-ink-tertiary hover:text-ink" onClick={() => setSelectedNodeId(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {adviceLoading && <div className="py-6 text-small text-ink-secondary">AI 正在分析该模块，请稍候...</div>}

            {adviceError && !adviceLoading && (
              <ErrorState type="server" title="建议获取失败" description={adviceError} onRetry={() => handleNodeClick(selectedNodeId)} />
            )}

            {advice && !adviceLoading && !adviceError && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-small font-semibold text-ink">{advice.nodeName}</p>
                  <p className="text-caption text-ink-tertiary mt-1">掌握度 {Math.round(advice.mastery * 100)}%</p>
                </div>

                <div className="rounded-[12px] bg-blue-light/40 p-3">
                  <p className="text-caption text-ink-secondary">个性化建议</p>
                  <p className="text-small text-ink mt-1 leading-6">{advice.suggestion}</p>
                </div>

                <div className="rounded-[12px] bg-bg-hover p-3">
                  <p className="text-caption text-ink-secondary">通俗解释</p>
                  <p className="text-small text-ink mt-1 leading-6">{advice.plainExplanation}</p>
                </div>

                <div className="rounded-[12px] bg-white border border-black/[0.06] p-3">
                  <p className="text-caption text-ink-secondary">本节点学习内容</p>
                  <ul className="mt-2 space-y-1.5">
                    {(advice.learningContents || []).map((item, idx) => (
                      <li key={idx} className="text-small text-ink leading-6">{idx + 1}. {item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-ink-secondary">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-caption">推荐行动</p>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {advice.nextActions.map((item, idx) => (
                      <li key={idx} className="text-small text-ink leading-6">{idx + 1}. {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  {advice.recommendedResources.map((r) => (
                    <span key={r} className="px-2 py-1 rounded-pill bg-bg-hover text-micro text-ink-secondary">
                      推荐资源：{r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

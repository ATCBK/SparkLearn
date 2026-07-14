'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import type { GraphData, KnowledgeEdge, KnowledgeNode } from '../types/graph'
import { cn } from '@/lib/utils/cn'

const STATUS_COLORS: Record<string, string> = {
  mastered: '#16A34A',
  learning: '#2563EB',
  not_started: '#F59E0B',
  locked: '#D1D5DB',
}

const STATUS_BORDER_COLORS: Record<string, string> = {
  mastered: '#15803D',
  learning: '#1D4ED8',
  not_started: '#D97706',
  locked: '#9CA3AF',
}

const STATUS_LABELS: Record<string, string> = {
  mastered: '已掌握',
  learning: '学习中',
  not_started: '未学习',
  locked: '未解锁',
}

function getNodeSize(mastery: number): number {
  return 30 + (mastery / 100) * 30
}

function hasNodeId(data: unknown): data is { id: string } {
  return Boolean(data && typeof data === 'object' && 'id' in data && typeof data.id === 'string')
}

function filterGraphData(graphData: GraphData, filter: string, searchQuery: string): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  let nodes = graphData.nodes

  if (filter !== 'all') {
    if (filter === 'not_started') {
      nodes = nodes.filter((n) => n.user_status.status === 'not_started' || n.user_status.status === 'locked')
    } else {
      nodes = nodes.filter((n) => n.user_status.status === filter)
    }
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    nodes = nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q),
    )
  }

  const visibleIds = new Set(nodes.map((n) => n.id))
  const edges = graphData.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))

  return { nodes, edges }
}

export function GraphCanvas() {
  const chartRef = useRef<ReturnType<typeof import('echarts').init> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEchartsReady, setIsEchartsReady] = useState(false)

  const graphData = useGraphStore((s) => s.graphData)
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId)
  const filter = useGraphStore((s) => s.filter)
  const searchQuery = useGraphStore((s) => s.searchQuery)
  const selectNode = useGraphStore((s) => s.selectNode)
  const isLoading = useGraphStore((s) => s.isLoading)
  const isFullscreen = useGraphStore((s) => s.isFullscreen)

  const { nodes: filteredNodes, edges: filteredEdges } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] }
    return filterGraphData(graphData, filter, searchQuery)
  }, [graphData, filter, searchQuery])

  const resizeChart = useCallback(() => {
    const chart = chartRef.current
    const container = containerRef.current

    if (!chart || chart.isDisposed() || !container?.isConnected || container.clientWidth === 0 || container.clientHeight === 0) {
      return
    }

    try {
      chart.resize()
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[GraphCanvas] resize skipped because chart is not ready', error)
      }
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined' || chartRef.current) return

    let disposed = false

    import('echarts').then((echarts) => {
      if (disposed || !containerRef.current) return

      const instance = echarts.init(containerRef.current, undefined, { renderer: 'canvas' })
      chartRef.current = instance
      setIsEchartsReady(true)

      instance.on('click', (params) => {
        if (params.dataType === 'node' && hasNodeId(params.data)) {
          selectNode(params.data.id)
        }
      })
    })

    return () => {
      disposed = true
      setIsEchartsReady(false)
      const chart = chartRef.current
      chartRef.current = null
      chart?.dispose()
    }
  }, [selectNode])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !isEchartsReady || !graphData || filteredNodes.length === 0) return

    const categories = Array.from(new Set(filteredNodes.map((n) => n.category))).map((cat) => ({ name: cat }))
    const categoryMap = new Map(categories.map((c, i) => [c.name, i]))

    const eNodes = filteredNodes.map((n) => ({
      id: n.id,
      name: n.name,
      value: n.user_status.mastery,
      category: categoryMap.get(n.category) ?? 0,
      symbolSize: getNodeSize(n.user_status.mastery),
      itemStyle: {
        color: STATUS_COLORS[n.user_status.status],
        borderColor: STATUS_BORDER_COLORS[n.user_status.status],
        borderWidth: n.id === selectedNodeId ? 3 : 1.5,
        shadowBlur: n.id === selectedNodeId ? 12 : 0,
        shadowColor: n.id === selectedNodeId ? 'rgba(37, 99, 235, 0.35)' : 'transparent',
      },
      label: {
        show: true,
        position: 'bottom' as const,
        formatter: '{b}',
        fontSize: 11,
        color: '#374151',
        distance: 5,
      },
    }))

    const eEdges = filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        type: e.type === 'prerequisite' ? 'solid' : ([5, 5] as number[]),
        color: e.type === 'prerequisite' ? '#CBD5E1' : '#93C5FD',
        width: e.type === 'prerequisite' ? 1.5 : 1,
        curveness: 0.15,
      },
    }))

    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          backgroundColor: '#fff',
          borderColor: '#E5EAF2',
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { color: '#111827', fontSize: 12 },
          extraCssText: 'border-radius:10px;box-shadow:0 4px 16px rgba(15,23,42,.08);',
          formatter: (params: { dataType?: string; data?: { name?: string; value?: number; id?: string } }) => {
            if (params.dataType !== 'node') return ''
            const node = filteredNodes.find((n) => n.id === params.data?.id)
            if (!node) return params.data?.name || ''
            const s = node.user_status
            return `
              <div style="padding:4px 0">
                <b style="font-size:14px">${node.name}</b>
                <span style="margin-left:8px;padding:2px 6px;border-radius:4px;font-size:11px;background:${STATUS_COLORS[s.status]}20;color:${STATUS_COLORS[s.status]}">${STATUS_LABELS[s.status]}</span>
                <div style="margin-top:6px;color:#6B7280;font-size:12px">${node.category} | 难度 ${'★'.repeat(node.difficulty)}${'☆'.repeat(5 - node.difficulty)}</div>
                <div style="margin-top:4px;font-size:12px">掌握度 <b>${s.mastery}%</b></div>
                <div style="font-size:12px">学习 ${s.study_hours}h | 做题 ${s.exercises_done} | 正确率 ${s.accuracy}%</div>
              </div>
            `.trim()
          },
        },
        animationDuration: 800,
        animationEasingUpdate: 'quinticInOut' as const,
        series: [
          {
            type: 'graph',
            layout: 'force',
            data: eNodes,
            links: eEdges,
            categories,
            roam: true,
            draggable: true,
            force: {
              repulsion: 320,
              gravity: 0.08,
              edgeLength: [100, 200],
              friction: 0.6,
            },
            emphasis: {
              focus: 'adjacency' as const,
              blurScope: 'global' as const,
              itemStyle: {
                borderWidth: 2.5,
                borderColor: '#2563EB',
                shadowBlur: 10,
                shadowColor: 'rgba(37, 99, 235, 0.25)',
              },
            },
            selectedMode: 'single' as const,
            select: {
              itemStyle: {
                borderWidth: 3,
                borderColor: '#2563EB',
                shadowBlur: 12,
                shadowColor: 'rgba(37, 99, 235, 0.35)',
              },
            },
            scaleLimit: {
              min: 0.4,
              max: 3,
            },
            edgeLabel: { show: false },
          },
        ],
      },
      true,
    )
  }, [filteredNodes, filteredEdges, graphData, selectedNodeId, isEchartsReady])

  useEffect(() => {
    const container = containerRef.current
    const handleResize = () => resizeChart()

    window.addEventListener('resize', handleResize)

    const resizeObserver = container ? new ResizeObserver(handleResize) : null
    if (container) {
      resizeObserver?.observe(container)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [resizeChart])

  useEffect(() => {
    const timer = setTimeout(() => resizeChart(), 150)
    return () => clearTimeout(timer)
  }, [isFullscreen, resizeChart])

  return (
    <div
      className={cn(
        'relative h-full min-h-[560px] w-full max-[900px]:h-[560px] max-[900px]:min-h-0',
        isFullscreen && 'h-[calc(100vh-170px)] max-h-none',
      )}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {(isLoading || !graphData || filteredNodes.length === 0) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
          {isLoading ? (
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue border-t-transparent" />
              <p className="text-small text-muted">加载知识图谱中...</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-body text-muted mb-4">
                {graphData ? '没有匹配的知识点，请调整筛选条件' : '暂无图谱数据'}
              </p>
              {!graphData && (
                <button
                  onClick={() => useGraphStore.getState().refreshGraph()}
                  className="rounded-[10px] bg-blue px-5 py-2 text-small font-bold text-white hover:bg-blue-dark transition-colors"
                >
                  AI 生成知识图谱
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

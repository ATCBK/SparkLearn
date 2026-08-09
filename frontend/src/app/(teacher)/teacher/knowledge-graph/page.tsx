'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Circle,
  FileText,
  GitBranch,
  Layers,
  Link2,
  MousePointer2,
  Move,
  Network,
  PanelRight,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import {
  createTeacherKnowledgeGraph,
  createTeacherKnowledgeGraphFromFiles,
  deleteTeacherKnowledgeGraph,
  getTeacherKnowledgeGraph,
  getTeacherKnowledgeGraphs,
  publishTeacherKnowledgeGraph,
  updateTeacherKnowledgeGraph,
} from '@/lib/api/real'
import type { TeacherKnowledgeGraph, TeacherKnowledgeGraphEdge, TeacherKnowledgeGraphNode } from '@/lib/api/types'
import { cn } from '@/lib/utils/cn'

const NODE_TYPES = ['知识点', '概念', '方法', '公式', '案例', '能力']
const EDGE_TYPES = ['前驱', '后继', '相关']
const TYPE_COLORS: Record<string, string> = {
  知识点: '#2563eb',
  概念: '#2563eb',
  方法: '#0f766e',
  公式: '#7c3aed',
  案例: '#d97706',
  能力: '#dc2626',
}

type Selection = { kind: 'node' | 'edge'; id: string } | null
type EChartsInstance = ReturnType<typeof import('echarts').init>
type ChartClickParams = {
  dataType?: string
  data?: {
    id?: string
  }
}

function splitClasses(value: string) {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
}

function joinClasses(value: string[]) {
  return value.join('，')
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`
}

function formatSize(value: number) {
  if (!value) return '0 KB'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function nodeSize(node: TeacherKnowledgeGraphNode) {
  return 30 + clamp(Number(node.difficulty || 2), 1, 5) * 8
}

function readableType(type: string) {
  return NODE_TYPES.includes(type) ? type : '知识点'
}

function readableEdgeType(type: string) {
  if (type === '前置知识') return '前驱'
  return EDGE_TYPES.includes(type) ? type : '相关'
}

function hasChartItemId(data: unknown): data is { id: string } {
  return Boolean(data && typeof data === 'object' && 'id' in data && typeof data.id === 'string')
}

export default function TeacherKnowledgeGraphPage() {
  const chartRef = useRef<EChartsInstance | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [graphs, setGraphs] = useState<TeacherKnowledgeGraph[]>([])
  const [currentGraph, setCurrentGraph] = useState<TeacherKnowledgeGraph | null>(null)
  const [nodes, setNodes] = useState<TeacherKnowledgeGraphNode[]>([])
  const [edges, setEdges] = useState<TeacherKnowledgeGraphEdge[]>([])
  const [title, setTitle] = useState('课程知识图谱')
  const [description, setDescription] = useState('')
  const [targetClasses, setTargetClasses] = useState('Python A 班')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  const [connectionMode, setConnectionMode] = useState(false)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [connectionType, setConnectionType] = useState('相关')
  const [isEchartsReady, setIsEchartsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const selectedNode = selection?.kind === 'node' ? nodes.find((node) => node.id === selection.id) || null : null
  const selectedEdge = selection?.kind === 'edge' ? edges.find((edge) => edge.id === selection.id) || null : null
  const publishedCount = useMemo(() => graphs.filter((item) => item.status === 'published').length, [graphs])
  const selectedNodeRelations = useMemo(() => {
    if (!selectedNode) return []
    return edges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge) => {
        const isOutgoing = edge.source === selectedNode.id
        const otherNodeId = isOutgoing ? edge.target : edge.source
        return {
          edge,
          isOutgoing,
          relation: readableEdgeType(edge.type),
          node: nodeMap.get(otherNodeId) || null,
        }
      })
      .filter((item) => item.node)
  }, [edges, nodeMap, selectedNode])

  const hydrateGraph = useCallback((graph: TeacherKnowledgeGraph) => {
    setCurrentGraph(graph)
    setTitle(graph.title || '课程知识图谱')
    setDescription(graph.description || '')
    setTargetClasses(joinClasses(graph.target_classes || []))
    setNodes(graph.nodes || [])
    setEdges((graph.edges || []).map((edge) => ({ ...edge, type: readableEdgeType(edge.type), label: readableEdgeType(edge.type) })))
    setSelection(null)
    setConnectSourceId(null)
    setConnectionMode(false)
  }, [])

  const openGraph = useCallback(async (graphId: number) => {
    setSaving(true)
    try {
      const graph = await getTeacherKnowledgeGraph(graphId)
      hydrateGraph(graph)
    } catch (error) {
      setToast(error instanceof Error ? error.message : '知识图谱加载失败')
    } finally {
      setSaving(false)
    }
  }, [hydrateGraph])

  const loadGraphs = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      if (!currentGraph && list[0]) {
        await openGraph(list[0].id)
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : '知识图谱列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [currentGraph, openGraph])

  useEffect(() => {
    void loadGraphs()
  }, [loadGraphs])

  const resizeChart = useCallback(() => {
    const chart = chartRef.current
    const container = chartContainerRef.current
    if (!chart || chart.isDisposed() || !container?.isConnected || container.clientWidth === 0 || container.clientHeight === 0) return
    chart.resize()
  }, [])

  async function handleGenerateFromFiles() {
    if (!uploadFiles.length) {
      setToast('请先选择 PDF、Word、Markdown 或 TXT 资料')
      return
    }
    setSaving(true)
    try {
      const graph = await createTeacherKnowledgeGraphFromFiles({
        title,
        description,
        targetClasses: splitClasses(targetClasses),
        files: uploadFiles,
      })
      hydrateGraph(graph)
      setUploadFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      setToast('已根据资料生成知识图谱草稿，可以继续拖拽、连线和编辑节点')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '资料分析失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateBlank() {
    setSaving(true)
    try {
      const graph = await createTeacherKnowledgeGraph({
        title: title.trim() || '手动知识图谱',
        description,
        target_classes: splitClasses(targetClasses),
      })
      hydrateGraph(graph)
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      setToast('已创建空白知识图谱')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '创建失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(status = currentGraph?.status || 'draft') {
    setSaving(true)
    try {
      const normalizedEdges = edges.map((edge) => {
        const edgeType = readableEdgeType(edge.type)
        return { ...edge, type: edgeType, label: edgeType }
      })
      const graph = currentGraph
        ? await updateTeacherKnowledgeGraph(currentGraph.id, {
            title,
            description,
            target_classes: splitClasses(targetClasses),
            status,
            nodes,
            edges: normalizedEdges,
          })
        : await createTeacherKnowledgeGraph({
            title,
            description,
            target_classes: splitClasses(targetClasses),
            nodes,
            edges: normalizedEdges,
          })
      hydrateGraph(graph)
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      setToast(status === 'published' ? '知识图谱已发布' : '知识图谱草稿已保存')
      return graph
    } catch (error) {
      setToast(error instanceof Error ? error.message : '保存失败')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    const saved = await handleSave('published')
    if (!saved) return
    setSaving(true)
    try {
      const graph = await publishTeacherKnowledgeGraph(saved.id)
      hydrateGraph(graph)
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      setToast('已发布到目标班级')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '发布失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGraph(graph: TeacherKnowledgeGraph) {
    if (!window.confirm(`确定删除《${graph.title}》吗？`)) return
    setSaving(true)
    try {
      await deleteTeacherKnowledgeGraph(graph.id)
      const list = await getTeacherKnowledgeGraphs()
      setGraphs(list)
      if (currentGraph?.id === graph.id) {
        if (list[0]) await openGraph(list[0].id)
        else {
          setCurrentGraph(null)
          setNodes([])
          setEdges([])
          setSelection(null)
        }
      }
      setToast('知识图谱已删除')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  function handleFiles(fileList: FileList | null) {
    const next = Array.from(fileList || []).filter((file) => /\.(pdf|docx|md|txt)$/i.test(file.name))
    setUploadFiles(next)
    if (next.length) setTitle((value) => value || `${next[0].name.replace(/\.[^.]+$/, '')} 知识图谱`)
  }

  function addNode() {
    const count = nodes.length
    const node: TeacherKnowledgeGraphNode = {
      id: newId('node'),
      label: `自定义节点 ${count + 1}`,
      type: '知识点',
      description: '教师手动添加的知识点。',
      difficulty: 2,
      x: 160 + (count % 4) * 150,
      y: 120 + Math.floor(count / 4) * 96,
      color: '#2563eb',
      source: 'custom',
    }
    setNodes((items) => [...items, node])
    setSelection({ kind: 'node', id: node.id })
  }

  const addEdgeBetween = useCallback((source: string, target: string, type = '相关') => {
    if (source === target) return
    const edgeType = readableEdgeType(type)
    const exists = edges.some((edge) => edge.source === source && edge.target === target && readableEdgeType(edge.type) === edgeType)
    if (exists) {
      setToast('这两个节点之间已经有相同关系')
      return
    }
    const edge: TeacherKnowledgeGraphEdge = { id: newId('edge'), source, target, type: edgeType, label: edgeType }
    setEdges((items) => [...items, edge])
    setSelection({ kind: 'edge', id: edge.id })
  }, [edges])

  const handleNodeClick = useCallback((node: TeacherKnowledgeGraphNode) => {
    if (!connectionMode) {
      setSelection({ kind: 'node', id: node.id })
      return
    }
    if (!connectSourceId) {
      setConnectSourceId(node.id)
      setSelection({ kind: 'node', id: node.id })
      return
    }
    addEdgeBetween(connectSourceId, node.id, connectionType)
    setConnectSourceId(null)
  }, [addEdgeBetween, connectionMode, connectSourceId, connectionType])

  function autoLayout() {
    const total = Math.max(1, nodes.length)
    setNodes((items) =>
      items.map((node, index) => {
        if (index === 0) return { ...node, x: 430, y: 270 }
        const angle = -Math.PI / 2 + ((index - 1) * 2 * Math.PI) / Math.max(1, total - 1)
        return {
          ...node,
          x: Math.round(430 + 270 * Math.cos(angle)),
          y: Math.round(270 + 175 * Math.sin(angle)),
        }
      }),
    )
  }

  function updateSelectedNode(patch: Partial<TeacherKnowledgeGraphNode>) {
    if (!selectedNode) return
    setNodes((items) =>
      items.map((node) =>
        node.id === selectedNode.id
          ? { ...node, ...patch, color: patch.type ? TYPE_COLORS[patch.type] || node.color : patch.color || node.color }
          : node,
      ),
    )
  }

  function updateSelectedEdge(patch: Partial<TeacherKnowledgeGraphEdge>) {
    if (!selectedEdge) return
    setEdges((items) =>
      items.map((edge) => {
        if (edge.id !== selectedEdge.id) return edge
        const nextType = readableEdgeType(String(patch.type || edge.type))
        return { ...edge, ...patch, type: nextType, label: nextType }
      }),
    )
  }

  function deleteSelection() {
    if (!selection) return
    if (selection.kind === 'node') {
      setNodes((items) => items.filter((node) => node.id !== selection.id))
      setEdges((items) => items.filter((edge) => edge.source !== selection.id && edge.target !== selection.id))
    } else {
      setEdges((items) => items.filter((edge) => edge.id !== selection.id))
    }
    setSelection(null)
  }

  useEffect(() => {
    if (!chartContainerRef.current || typeof window === 'undefined' || chartRef.current) return
    let disposed = false

    import('echarts').then((echarts) => {
      if (disposed || !chartContainerRef.current) return
      chartRef.current = echarts.init(chartContainerRef.current, undefined, { renderer: 'canvas' })
      setIsEchartsReady(true)
    })

    return () => {
      disposed = true
      setIsEchartsReady(false)
      const chart = chartRef.current
      chartRef.current = null
      chart?.dispose()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !isEchartsReady) return

    chart.off('click')
    chart.on('click', (params: unknown) => {
      const event = params as ChartClickParams
      if (event.dataType === 'node' && hasChartItemId(event.data)) {
        const node = nodeMap.get(event.data.id)
        if (node) handleNodeClick(node)
        return
      }
      if (event.dataType === 'edge' && hasChartItemId(event.data)) {
        setSelection({ kind: 'edge', id: event.data.id })
      }
    })
  }, [isEchartsReady, nodeMap, connectionMode, connectSourceId, edges, handleNodeClick])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !isEchartsReady) return

    if (nodes.length === 0) {
      chart.clear()
      return
    }

    const categories = NODE_TYPES.map((name) => ({ name }))
    const categoryMap = new Map(categories.map((category, index) => [category.name, index]))

    const chartNodes = nodes.map((node) => {
      const type = readableType(node.type)
      const selected = selection?.kind === 'node' && selection.id === node.id
      const isConnectSource = connectSourceId === node.id
      const color = node.color || TYPE_COLORS[type] || '#2563eb'
      return {
        id: node.id,
        name: node.label,
        value: node.difficulty,
        x: node.x,
        y: node.y,
        category: categoryMap.get(type) ?? 0,
        symbolSize: nodeSize(node),
        itemStyle: {
          color,
          borderColor: isConnectSource ? '#f59e0b' : selected ? '#2563eb' : color,
          borderWidth: selected || isConnectSource ? 4 : 1.5,
          shadowBlur: selected || isConnectSource ? 16 : 8,
          shadowColor: selected ? 'rgba(37,99,235,0.38)' : isConnectSource ? 'rgba(245,158,11,0.35)' : `${color}40`,
        },
        label: {
          show: true,
          position: 'bottom' as const,
          formatter: '{b}',
          fontSize: 11,
          fontWeight: 700,
          color: '#374151',
          distance: 7,
          width: 112,
          overflow: 'truncate' as const,
        },
      }
    })

    const chartEdges = edges
      .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
      .map((edge) => {
        const selected = selection?.kind === 'edge' && selection.id === edge.id
        const edgeType = readableEdgeType(edge.type)
        const isPrerequisite = edgeType === '前驱'
        const isSuccessor = edgeType === '后继'
        const isRelated = edgeType === '相关'
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          name: edgeType,
          type: edgeType,
          lineStyle: {
            color: selected ? '#2563eb' : isPrerequisite ? '#CBD5E1' : isSuccessor ? '#67E8F9' : '#93C5FD',
            width: selected ? 2.8 : isPrerequisite ? 1.5 : 1.2,
            type: isRelated ? ([5, 5] as number[]) : 'solid',
            curveness: 0.15,
            opacity: selected ? 0.96 : 0.78,
          },
          label: {
            show: false,
            formatter: '',
            color: '#2563eb',
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: '#ffffff',
            borderColor: '#bfdbfe',
            borderWidth: 1,
            borderRadius: 4,
            padding: [3, 6],
          },
        }
      })

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
          formatter: (params: { dataType?: string; data?: { id?: string; name?: string } }) => {
            if (params.dataType === 'edge') {
              const edge = edges.find((item) => item.id === params.data?.id)
              if (!edge) return ''
              return `<b>${readableEdgeType(edge.type)}</b>`
            }
            const node = nodes.find((item) => item.id === params.data?.id)
            if (!node) return params.data?.name || ''
            const type = readableType(node.type)
            return `
              <div style="padding:4px 0;max-width:260px">
                <b style="font-size:14px">${node.label}</b>
                <span style="margin-left:8px;padding:2px 6px;border-radius:4px;font-size:11px;background:${(node.color || TYPE_COLORS[type])}20;color:${node.color || TYPE_COLORS[type]}">${type}</span>
                <div style="margin-top:6px;color:#6B7280;font-size:12px">难度 ${'★'.repeat(node.difficulty)}${'☆'.repeat(5 - node.difficulty)}</div>
                <div style="margin-top:4px;color:#475569;font-size:12px;line-height:1.6">${node.description || '暂无说明'}</div>
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
            data: chartNodes,
            links: chartEdges,
            categories,
            roam: true,
            draggable: true,
            focusNodeAdjacency: true,
            force: {
              repulsion: 360,
              gravity: 0.08,
              edgeLength: [105, 210],
              friction: 0.58,
            },
            emphasis: {
              focus: 'adjacency' as const,
              blurScope: 'global' as const,
              itemStyle: {
                borderWidth: 3,
                borderColor: '#2563EB',
                shadowBlur: 14,
                shadowColor: 'rgba(37, 99, 235, 0.28)',
              },
              lineStyle: {
                width: 2.6,
                color: '#2563eb',
              },
            },
            selectedMode: 'single' as const,
            scaleLimit: {
              min: 0.35,
              max: 3,
            },
            edgeSymbol: ['none', 'arrow'],
            edgeSymbolSize: 7,
            edgeLabel: {
              show: false,
            },
          },
        ],
      },
      true,
    )
  }, [isEchartsReady, nodes, edges, nodeMap, selection, connectSourceId])

  useEffect(() => {
    const container = chartContainerRef.current
    const handleResize = () => resizeChart()
    window.addEventListener('resize', handleResize)
    const resizeObserver = container ? new ResizeObserver(handleResize) : null
    if (container) resizeObserver?.observe(container)
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [resizeChart])

  return (
    <div>
      <PageHead
        eyebrow="教师工作台 / 知识图谱"
        title="知识图谱"
        description="上传课程资料生成图谱草稿，教师可继续自定义节点、调整关系并发布到目标班级。"
        actions={
          <div className="flex flex-wrap gap-2">
            <ProtoButton variant="secondary" onClick={() => void loadGraphs()} disabled={saving}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </ProtoButton>
            <ProtoButton variant="secondary" onClick={() => void handleSave('draft')} disabled={saving || nodes.length === 0}>
              <Save className="h-4 w-4" />
              保存草稿
            </ProtoButton>
            <ProtoButton onClick={() => void handlePublish()} disabled={saving || nodes.length === 0}>
              <Send className="h-4 w-4" />
              发布
            </ProtoButton>
          </div>
        }
        chips={[
          { value: String(graphs.length), label: '图谱总数', icon: <Network className="h-4 w-4" />, tone: 'blue' },
          { value: String(publishedCount), label: '已发布', icon: <Send className="h-4 w-4" />, tone: 'green' },
          { value: String(nodes.length), label: '当前节点', icon: <Circle className="h-4 w-4" />, tone: 'cyan' },
          { value: String(edges.length), label: '当前关系', icon: <GitBranch className="h-4 w-4" />, tone: 'orange' },
        ]}
      />

      {toast && (
        <div className="mb-4 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm font-semibold text-[#1d4ed8]">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-[280px_minmax(0,1fr)_320px] gap-4 max-[1180px]:grid-cols-[260px_minmax(0,1fr)] max-[860px]:grid-cols-1">
        <aside className="space-y-4">
          <ProtoCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#0f172a]">资料生成</h2>
              <Pill tone="blue">PDF / Word / MD / TXT</Pill>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">图谱名称</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">发布班级</span>
                <input
                  value={targetClasses}
                  onChange={(event) => setTargetClasses(event.target.value)}
                  placeholder="多个班级用逗号分隔"
                  className="h-10 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[#64748b]">说明</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#dbe7f5] px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#93c5fd] bg-[#f8fbff] px-3 text-center text-sm font-bold text-[#1d4ed8] hover:bg-[#eff6ff]">
                <UploadCloud className="h-5 w-5" />
                选择资料
                <span className="text-xs font-medium text-[#64748b]">支持 .pdf / .docx / .md / .txt</span>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.md,.txt,text/plain,application/pdf" className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              </label>
              {uploadFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg bg-[#f8fafc] px-2.5 py-2 text-xs text-[#475569]">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="shrink-0 text-[#94a3b8]">{formatSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleGenerateFromFiles()}
                disabled={saving || uploadFiles.length === 0}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] text-sm font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                分析并生成图谱
              </button>
              <button
                type="button"
                onClick={() => void handleCreateBlank()}
                disabled={saving}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#bfdbfe] bg-white text-sm font-bold text-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                新建空白图谱
              </button>
            </div>
          </ProtoCard>

          <ProtoCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#0f172a]">图谱列表</h2>
              <Pill tone="neutral">{loading ? '加载中' : `${graphs.length} 个`}</Pill>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {graphs.length === 0 ? (
                <SoftCard className="text-sm text-[#64748b]">还没有知识图谱，可以先上传资料生成一版。</SoftCard>
              ) : (
                graphs.map((graph) => (
                  <button
                    key={graph.id}
                    type="button"
                    onClick={() => void openGraph(graph.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      currentGraph?.id === graph.id ? 'border-[#93c5fd] bg-[#eff6ff]' : 'border-[#e5e7eb] bg-white hover:bg-[#f8fafc]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1 text-sm font-bold text-[#0f172a]">{graph.title}</span>
                      <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', graph.status === 'published' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]')}>
                        {graph.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#64748b]">{graph.node_count} 节点 / {graph.edge_count} 关系</div>
                  </button>
                ))
              )}
            </div>
          </ProtoCard>
        </aside>

        <main className="min-w-0">
          <ProtoCard className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode(false)
                    setConnectSourceId(null)
                  }}
                  className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold', !connectionMode ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]')}
                >
                  <MousePointer2 className="h-4 w-4" />
                  选择
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode(true)
                    setConnectSourceId(null)
                  }}
                  className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold', connectionMode ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]')}
                >
                  <Link2 className="h-4 w-4" />
                  连接
                </button>
                <label className="flex h-9 items-center gap-2 rounded-lg border border-[#dbe7f5] bg-white px-2 text-xs font-bold text-[#475569]">
                  <span className="shrink-0">关系</span>
                  <select
                    value={connectionType}
                    onChange={(event) => setConnectionType(event.target.value)}
                    className="h-7 rounded-md border-0 bg-transparent px-1 text-xs font-bold text-[#0f172a] outline-none"
                  >
                    {EDGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <button type="button" onClick={addNode} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 text-xs font-bold text-[#475569] hover:bg-[#e2e8f0]">
                  <Plus className="h-4 w-4" />
                  节点
                </button>
                <button type="button" onClick={autoLayout} disabled={nodes.length === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 text-xs font-bold text-[#475569] hover:bg-[#e2e8f0] disabled:opacity-50">
                  <Wand2 className="h-4 w-4" />
                  布局
                </button>
                <button type="button" onClick={deleteSelection} disabled={!selection} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#fef2f2] px-3 text-xs font-bold text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
                {connectionMode ? (
                  <span>{connectSourceId ? `请选择目标节点，将建立“${connectionType}”关系` : '请选择起始节点'}</span>
                ) : (
                  <>
                    <Move className="h-4 w-4" />
                    <span>滚轮缩放，拖动画布，拖拽节点</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-[#f8fafc] p-3">
              <div className="relative h-[600px] min-h-[520px] overflow-hidden rounded-lg border border-[#dbe7f5] bg-white max-[760px]:h-[520px]">
                <div ref={chartContainerRef} className="absolute inset-0 h-full w-full" aria-label="知识图谱画布" />

                {nodes.length === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                    <div className="max-w-[360px] text-center">
                      <Network className="mx-auto h-10 w-10 text-[#bfdbfe]" />
                      <p className="mt-3 text-sm font-bold text-[#0f172a]">还没有图谱内容</p>
                      <p className="mt-1 text-sm leading-6 text-[#64748b]">上传资料自动生成，或先新建空白图谱再手动添加节点。</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ProtoCard>
        </main>

        <aside className="space-y-4 max-[1180px]:col-span-2 max-[860px]:col-span-1">
          <ProtoCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#0f172a]">
                <PanelRight className="h-4 w-4 text-[#2563eb]" />
                属性面板
              </h2>
              {selection && <Pill tone={selection.kind === 'node' ? 'blue' : 'orange'}>{selection.kind === 'node' ? '节点' : '关系'}</Pill>}
            </div>

            {!selection ? (
              <SoftCard className="text-sm leading-6 text-[#64748b]">选择画布中的节点或关系后，可在这里编辑名称、类型、难度和说明。</SoftCard>
            ) : selectedNode ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">节点名称</span>
                  <input value={selectedNode.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} className="h-10 w-full rounded-lg border border-[#dbe7f5] px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">节点类型</span>
                  <select value={selectedNode.type} onChange={(event) => updateSelectedNode({ type: event.target.value })} className="h-10 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100">
                    {NODE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">难度</span>
                  <input type="range" min={1} max={5} value={selectedNode.difficulty} onChange={(event) => updateSelectedNode({ difficulty: Number(event.target.value) })} className="w-full accent-[#2563eb]" />
                  <div className="text-xs font-semibold text-[#2563eb]">当前难度：{selectedNode.difficulty}</div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">说明</span>
                  <textarea value={selectedNode.description} onChange={(event) => updateSelectedNode({ description: event.target.value })} rows={5} className="w-full resize-none rounded-lg border border-[#dbe7f5] px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100" />
                </label>
                <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#64748b]">关联节点</span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[#2563eb]">{selectedNodeRelations.length} 个</span>
                  </div>
                  {selectedNodeRelations.length ? (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {selectedNodeRelations.map((item) => (
                        <button
                          key={item.edge.id}
                          type="button"
                          onClick={() => setSelection({ kind: 'edge', id: item.edge.id })}
                          className="w-full rounded-lg border border-[#e5e7eb] bg-white p-2 text-left hover:border-[#bfdbfe] hover:bg-[#eff6ff]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-sm font-bold text-[#0f172a]">{item.node?.label}</span>
                            <span className="shrink-0 rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-bold text-[#2563eb]">{item.relation}</span>
                          </div>
                          <div className="mt-1 text-[11px] font-semibold text-[#94a3b8]">
                            {item.isOutgoing ? '本节点指向该节点' : '该节点指向本节点'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-white p-3 text-xs leading-5 text-[#94a3b8]">当前节点暂时没有关联节点。</div>
                  )}
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-[#64748b]">关系类型</span>
                  <select value={readableEdgeType(selectedEdge.type)} onChange={(event) => updateSelectedEdge({ type: event.target.value, label: event.target.value })} className="h-10 w-full rounded-lg border border-[#dbe7f5] bg-white px-3 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100">
                    {EDGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <div className="rounded-lg bg-[#f8fafc] p-3 text-xs leading-6 text-[#475569]">
                  <div><b>起点：</b>{nodeMap.get(selectedEdge.source)?.label || '未知节点'}</div>
                  <div><b>终点：</b>{nodeMap.get(selectedEdge.target)?.label || '未知节点'}</div>
                </div>
              </div>
            ) : null}
          </ProtoCard>

          <ProtoCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#0f172a]">
                <Layers className="h-4 w-4 text-[#2563eb]" />
                来源资料
              </h2>
              <Pill tone={currentGraph?.status === 'published' ? 'green' : 'neutral'}>{currentGraph?.status === 'published' ? '已发布' : '草稿'}</Pill>
            </div>
            {currentGraph?.source_files?.length ? (
              <div className="space-y-2">
                {currentGraph.source_files.map((file) => (
                  <div key={file.filename} className="rounded-lg border border-[#e5e7eb] bg-white p-3">
                    <div className="line-clamp-1 text-sm font-bold text-[#0f172a]">{file.filename}</div>
                    <div className="mt-1 text-xs text-[#64748b]">{formatSize(file.size_bytes)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <SoftCard className="text-sm text-[#64748b]">当前图谱没有绑定来源资料。</SoftCard>
            )}
            {currentGraph?.source_summary && (
              <p className="mt-3 rounded-lg bg-[#f8fafc] p-3 text-xs leading-6 text-[#64748b]">{currentGraph.source_summary}</p>
            )}
            {currentGraph && (
              <button
                type="button"
                onClick={() => void handleDeleteGraph(currentGraph)}
                disabled={saving}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#fecaca] bg-white text-sm font-bold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                删除当前图谱
              </button>
            )}
          </ProtoCard>
        </aside>
      </div>
    </div>
  )
}

// 知识图谱状态管理 (Zustand)
import { create } from 'zustand'
import type { GraphData, NodeDetail } from '../types/graph'
import { fetchGraphData, fetchNodeDetail, generateGraph as apiGenerateGraph } from '../api/graph'

export type FilterType = 'all' | 'mastered' | 'learning' | 'not_started'

interface GraphState {
  /** 图谱完整数据 */
  graphData: GraphData | null
  /** 当前选中节点 ID */
  selectedNodeId: string | null
  /** 当前选中节点详情 */
  nodeDetail: NodeDetail | null
  /** 状态筛选 */
  filter: FilterType
  /** 搜索关键词 */
  searchQuery: string
  /** 是否全屏 */
  isFullscreen: boolean
  /** 加载中 */
  isLoading: boolean
  /** 详情加载中 */
  isDetailLoading: boolean

  // ─── Actions ───
  setFilter: (filter: FilterType) => void
  setSearch: (query: string) => void
  selectNode: (nodeId: string | null) => void
  toggleFullscreen: () => void
  loadData: () => Promise<void>
  refreshGraph: () => Promise<void>
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphData: null,
  selectedNodeId: null,
  nodeDetail: null,
  filter: 'all',
  searchQuery: '',
  isFullscreen: false,
  isLoading: false,
  isDetailLoading: false,

  setFilter: (filter) => set({ filter }),

  setSearch: (searchQuery) => set({ searchQuery }),

  selectNode: async (nodeId) => {
    set({ selectedNodeId: nodeId })
    if (!nodeId) {
      set({ nodeDetail: null })
      return
    }
    set({ isDetailLoading: true })
    try {
      const detail = await fetchNodeDetail(nodeId, get().graphData || undefined)
      set({ nodeDetail: detail })
    } catch (error) {
      console.error('加载节点详情失败:', error)
      set({ nodeDetail: null })
    } finally {
      set({ isDetailLoading: false })
    }
  },

  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),

  loadData: async () => {
    set({ isLoading: true })
    try {
      const data = await fetchGraphData()
      set({ graphData: data })
    } catch (error) {
      console.error('加载图谱数据失败:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  refreshGraph: async () => {
    set({ isLoading: true, selectedNodeId: null, nodeDetail: null })
    try {
      const data = await apiGenerateGraph()
      set({ graphData: data })
    } catch (error) {
      console.error('重新生成图谱失败:', error)
    } finally {
      set({ isLoading: false })
    }
  },
}))

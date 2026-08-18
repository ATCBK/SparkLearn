// 知识图谱类型定义

/** 知识节点用户学习状态 */
export interface UserNodeStatus {
  mastery: number // 0-100
  status: 'mastered' | 'learning' | 'not_started' | 'locked'
  study_hours: number
  exercises_done: number
  exercises_correct: number
  accuracy: number
  last_studied: string | null
}

/** 知识节点 */
export interface KnowledgeNode {
  id: string
  name: string
  category: string
  difficulty: number
  description: string
  user_status: UserNodeStatus
}

/** 知识边（依赖/推荐关系） */
export interface KnowledgeEdge {
  source: string
  target: string
  type: 'prerequisite' | 'recommended'
  weight: number
}

/** 图谱统计数据 */
export interface GraphStats {
  total: number
  mastered: number
  learning: number
  not_started: number
  locked: number
}

/** 完整图谱数据 */
export interface GraphData {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  stats: GraphStats
}

/** 节点关联项（前置/后续知识） */
export interface NodeRelation {
  id: string
  name: string
  mastery: number
  status: string
}

/** 节点详情 */
export interface NodeDetail {
  node: KnowledgeNode
  prerequisites: NodeRelation[]
  successors: NodeRelation[]
  ai_suggestion: string
}

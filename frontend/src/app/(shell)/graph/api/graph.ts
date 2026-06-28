// 知识图谱 API 封装
import type { GraphData, NodeDetail, KnowledgeNode, KnowledgeEdge, NodeRelation } from '../types/graph'
import { getToken } from '@/lib/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

type RawUserStatus = Partial<KnowledgeNode['user_status']>
type RawGraphNode = Partial<Omit<KnowledgeNode, 'user_status'>> & {
  user_status?: RawUserStatus
}
type RawGraphEdge = Partial<KnowledgeEdge>
type RawGraphData = Partial<GraphData> & {
  nodes?: RawGraphNode[]
  edges?: RawGraphEdge[]
}
type RawNodeDetail = {
  node: RawGraphNode
  prerequisites?: NodeRelation[]
  successors?: NodeRelation[]
  ai_suggestion?: string
}

function normalizeNode(n: RawGraphNode): KnowledgeNode {
  const status = n.user_status?.status
  return {
    id: String(n.id),
    name: String(n.name),
    category: String(n.category || ''),
    difficulty: Number(n.difficulty || 1),
    description: String(n.description || ''),
    user_status: {
      mastery: Number(n.user_status?.mastery ?? 0),
      status: status === 'mastered' || status === 'learning' || status === 'locked' ? status : 'not_started',
      study_hours: Number(n.user_status?.study_hours ?? 0),
      exercises_done: Number(n.user_status?.exercises_done ?? 0),
      exercises_correct: Number(n.user_status?.exercises_correct ?? 0),
      accuracy: Number(n.user_status?.accuracy ?? 0),
      last_studied: n.user_status?.last_studied ?? null,
    },
  }
}

function normalizeEdge(e: RawGraphEdge): KnowledgeEdge {
  const type = e.type === 'recommended' ? 'recommended' : 'prerequisite'
  return {
    source: String(e.source),
    target: String(e.target),
    type,
    weight: Number(e.weight ?? 1),
  }
}

// ─── Mock 数据 ───────────────────────────────────────────────────────────────

const MOCK_NODES: KnowledgeNode[] = [
  { id: 'py-basics', name: 'Python 基础语法', category: '基础', difficulty: 1, description: '变量、数据类型、运算符、输入输出等 Python 基础概念', user_status: { mastery: 95, status: 'mastered', study_hours: 8, exercises_done: 30, exercises_correct: 28, accuracy: 93, last_studied: '2026-05-20' } },
  { id: 'py-control', name: '流程控制', category: '基础', difficulty: 1, description: 'if/elif/else 条件判断、for/while 循环、break/continue', user_status: { mastery: 88, status: 'mastered', study_hours: 6, exercises_done: 25, exercises_correct: 22, accuracy: 88, last_studied: '2026-05-22' } },
  { id: 'py-data-struct', name: '数据结构', category: '基础', difficulty: 2, description: '列表、元组、字典、集合的操作与应用', user_status: { mastery: 82, status: 'mastered', study_hours: 10, exercises_done: 35, exercises_correct: 29, accuracy: 83, last_studied: '2026-05-25' } },
  { id: 'py-string', name: '字符串处理', category: '基础', difficulty: 1, description: '字符串方法、格式化、正则表达式基础', user_status: { mastery: 90, status: 'mastered', study_hours: 5, exercises_done: 20, exercises_correct: 18, accuracy: 90, last_studied: '2026-05-21' } },
  { id: 'py-function', name: '函数定义与调用', category: '核心', difficulty: 2, description: '函数定义、参数传递、返回值、作用域', user_status: { mastery: 72, status: 'learning', study_hours: 7, exercises_done: 18, exercises_correct: 13, accuracy: 72, last_studied: '2026-06-01' } },
  { id: 'py-scope', name: '作用域与闭包', category: '核心', difficulty: 3, description: 'LEGB 规则、闭包、nonlocal/global 关键字', user_status: { mastery: 45, status: 'learning', study_hours: 3, exercises_done: 10, exercises_correct: 5, accuracy: 50, last_studied: '2026-06-01' } },
  { id: 'py-decorator', name: '装饰器', category: '核心', difficulty: 3, description: '装饰器原理、自定义装饰器、带参数装饰器', user_status: { mastery: 30, status: 'learning', study_hours: 2, exercises_done: 5, exercises_correct: 2, accuracy: 40, last_studied: '2026-05-30' } },
  { id: 'py-oop', name: '面向对象编程', category: '进阶', difficulty: 3, description: '类与对象、继承、多态、封装', user_status: { mastery: 55, status: 'learning', study_hours: 5, exercises_done: 12, exercises_correct: 7, accuracy: 58, last_studied: '2026-05-28' } },
  { id: 'py-exception', name: '异常处理', category: '核心', difficulty: 2, description: 'try/except/finally、自定义异常、异常链', user_status: { mastery: 60, status: 'learning', study_hours: 3, exercises_done: 8, exercises_correct: 5, accuracy: 63, last_studied: '2026-05-29' } },
  { id: 'py-module', name: '模块与包', category: '核心', difficulty: 2, description: 'import 机制、包结构、__init__.py、pip', user_status: { mastery: 65, status: 'learning', study_hours: 4, exercises_done: 10, exercises_correct: 7, accuracy: 70, last_studied: '2026-05-27' } },
  { id: 'py-file-io', name: '文件操作', category: '应用', difficulty: 2, description: '文件读写、with 语句、CSV/JSON 处理', user_status: { mastery: 48, status: 'learning', study_hours: 3, exercises_done: 8, exercises_correct: 4, accuracy: 50, last_studied: '2026-05-26' } },
  { id: 'py-iter-gen', name: '迭代器与生成器', category: '进阶', difficulty: 3, description: '迭代协议、生成器函数、yield 关键字', user_status: { mastery: 25, status: 'learning', study_hours: 2, exercises_done: 5, exercises_correct: 1, accuracy: 20, last_studied: '2026-05-25' } },
  { id: 'py-comprehension', name: '推导式', category: '核心', difficulty: 2, description: '列表推导式、字典推导式、生成器表达式', user_status: { mastery: 55, status: 'learning', study_hours: 2, exercises_done: 8, exercises_correct: 4, accuracy: 50, last_studied: '2026-05-24' } },
  { id: 'py-lambda', name: 'Lambda 与高阶函数', category: '核心', difficulty: 2, description: 'lambda 表达式、map/filter/reduce/sorted', user_status: { mastery: 40, status: 'learning', study_hours: 2, exercises_done: 6, exercises_correct: 3, accuracy: 50, last_studied: '2026-05-23' } },
  { id: 'py-regex', name: '正则表达式', category: '应用', difficulty: 3, description: 're 模块、匹配模式、分组与替换', user_status: { mastery: 35, status: 'learning', study_hours: 2, exercises_done: 6, exercises_correct: 2, accuracy: 33, last_studied: '2026-05-22' } },
  { id: 'py-class-adv', name: '高级面向对象', category: '进阶', difficulty: 4, description: '魔术方法、元类、描述符、ABC', user_status: { mastery: 15, status: 'not_started', study_hours: 1, exercises_done: 2, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-concurrency', name: '并发编程', category: '进阶', difficulty: 4, description: 'threading、multiprocessing、asyncio', user_status: { mastery: 10, status: 'not_started', study_hours: 0.5, exercises_done: 1, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-network', name: '网络编程', category: '应用', difficulty: 3, description: 'socket、HTTP 请求、requests 库', user_status: { mastery: 20, status: 'not_started', study_hours: 1, exercises_done: 3, exercises_correct: 1, accuracy: 33, last_studied: null } },
  { id: 'py-database', name: '数据库操作', category: '应用', difficulty: 3, description: 'SQLite、SQLAlchemy ORM、CRUD 操作', user_status: { mastery: 18, status: 'not_started', study_hours: 1, exercises_done: 2, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-testing', name: '单元测试', category: '工程', difficulty: 2, description: 'unittest、pytest、mock、测试覆盖率', user_status: { mastery: 22, status: 'not_started', study_hours: 1, exercises_done: 3, exercises_correct: 1, accuracy: 33, last_studied: null } },
  { id: 'py-design-pattern', name: '设计模式', category: '进阶', difficulty: 4, description: '单例、工厂、观察者、策略模式', user_status: { mastery: 8, status: 'locked', study_hours: 0, exercises_done: 0, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-advance-algo', name: '算法进阶', category: '进阶', difficulty: 5, description: '动态规划、图算法、贪心算法', user_status: { mastery: 5, status: 'locked', study_hours: 0, exercises_done: 0, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-web', name: 'Web 开发基础', category: '应用', difficulty: 3, description: 'Flask/FastAPI 框架、路由、模板', user_status: { mastery: 12, status: 'locked', study_hours: 0.5, exercises_done: 1, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-data-analysis', name: '数据分析', category: '应用', difficulty: 3, description: 'Pandas、NumPy、数据清洗与可视化', user_status: { mastery: 10, status: 'locked', study_hours: 0.5, exercises_done: 1, exercises_correct: 0, accuracy: 0, last_studied: null } },
  { id: 'py-magic-methods', name: '魔术方法详解', category: '进阶', difficulty: 4, description: '__str__, __repr__, __call__, __getitem__ 等', user_status: { mastery: 0, status: 'locked', study_hours: 0, exercises_done: 0, exercises_correct: 0, accuracy: 0, last_studied: null } },
]

const MOCK_EDGES: KnowledgeEdge[] = [
  // 基础依赖链
  { source: 'py-basics', target: 'py-control', type: 'prerequisite', weight: 1 },
  { source: 'py-basics', target: 'py-string', type: 'prerequisite', weight: 1 },
  { source: 'py-control', target: 'py-data-struct', type: 'prerequisite', weight: 1 },
  { source: 'py-data-struct', target: 'py-function', type: 'prerequisite', weight: 1 },
  { source: 'py-function', target: 'py-scope', type: 'prerequisite', weight: 1 },
  { source: 'py-scope', target: 'py-decorator', type: 'prerequisite', weight: 1 },
  { source: 'py-function', target: 'py-oop', type: 'prerequisite', weight: 1 },
  { source: 'py-function', target: 'py-exception', type: 'prerequisite', weight: 0.8 },
  { source: 'py-function', target: 'py-module', type: 'prerequisite', weight: 1 },
  { source: 'py-module', target: 'py-file-io', type: 'prerequisite', weight: 0.8 },
  { source: 'py-data-struct', target: 'py-comprehension', type: 'prerequisite', weight: 1 },
  { source: 'py-function', target: 'py-lambda', type: 'prerequisite', weight: 1 },
  { source: 'py-string', target: 'py-regex', type: 'prerequisite', weight: 0.8 },
  { source: 'py-oop', target: 'py-class-adv', type: 'prerequisite', weight: 1 },
  { source: 'py-oop', target: 'py-concurrency', type: 'prerequisite', weight: 0.6 },
  { source: 'py-module', target: 'py-network', type: 'prerequisite', weight: 0.8 },
  { source: 'py-file-io', target: 'py-database', type: 'prerequisite', weight: 0.8 },
  { source: 'py-exception', target: 'py-testing', type: 'prerequisite', weight: 0.6 },
  { source: 'py-class-adv', target: 'py-design-pattern', type: 'prerequisite', weight: 1 },
  { source: 'py-data-struct', target: 'py-advance-algo', type: 'prerequisite', weight: 0.8 },
  { source: 'py-module', target: 'py-web', type: 'prerequisite', weight: 1 },
  { source: 'py-data-struct', target: 'py-data-analysis', type: 'prerequisite', weight: 1 },
  { source: 'py-oop', target: 'py-magic-methods', type: 'prerequisite', weight: 1 },
  { source: 'py-decorator', target: 'py-web', type: 'prerequisite', weight: 0.5 },
  // 推荐关联
  { source: 'py-lambda', target: 'py-comprehension', type: 'recommended', weight: 0.6 },
  { source: 'py-iter-gen', target: 'py-comprehension', type: 'recommended', weight: 0.7 },
  { source: 'py-function', target: 'py-iter-gen', type: 'prerequisite', weight: 0.8 },
  { source: 'py-decorator', target: 'py-class-adv', type: 'recommended', weight: 0.5 },
  { source: 'py-testing', target: 'py-web', type: 'recommended', weight: 0.6 },
  { source: 'py-database', target: 'py-web', type: 'recommended', weight: 0.7 },
  { source: 'py-data-analysis', target: 'py-advance-algo', type: 'recommended', weight: 0.5 },
  { source: 'py-network', target: 'py-web', type: 'recommended', weight: 0.7 },
  { source: 'py-magic-methods', target: 'py-design-pattern', type: 'recommended', weight: 0.6 },
]

function computeStats(nodes: KnowledgeNode[]) {
  const stats = { total: nodes.length, mastered: 0, learning: 0, not_started: 0, locked: 0 }
  for (const n of nodes) {
    if (n.user_status.status === 'mastered') stats.mastered++
    else if (n.user_status.status === 'learning') stats.learning++
    else if (n.user_status.status === 'not_started') stats.not_started++
    else if (n.user_status.status === 'locked') stats.locked++
  }
  return stats
}

const MOCK_GRAPH_DATA: GraphData = {
  nodes: MOCK_NODES,
  edges: MOCK_EDGES,
  stats: computeStats(MOCK_NODES),
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

function _authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch { /* ignore */ }
  return headers
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ..._authHeaders(), ...(init?.headers || {}) },
  })
  const json = await res.json() as { success: boolean; data: T; error?: string }
  if (!res.ok || !json.success) {
    throw new Error(json.error || `请求失败：${res.status}`)
  }
  return json.data
}

/** 从图谱数据中推导节点的前置/后续知识 */
function deriveRelations(
  graphData: GraphData,
  nodeId: string,
): { prerequisites: NodeRelation[]; successors: NodeRelation[] } {
  const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]))
  const prerequisites: NodeRelation[] = []
  const successors: NodeRelation[] = []

  for (const edge of graphData.edges) {
    if (edge.type !== 'prerequisite') continue
    if (edge.target === nodeId) {
      const node = nodeMap.get(edge.source)
      if (node) {
        prerequisites.push({
          id: node.id,
          name: node.name,
          mastery: node.user_status.mastery,
          status: node.user_status.status,
        })
      }
    }
    if (edge.source === nodeId) {
      const node = nodeMap.get(edge.target)
      if (node) {
        successors.push({
          id: node.id,
          name: node.name,
          mastery: node.user_status.mastery,
          status: node.user_status.status,
        })
      }
    }
  }

  return { prerequisites, successors }
}

/** 根据节点状态生成 AI 建议 */
function generateAiSuggestion(node: KnowledgeNode): string {
  const { mastery, status } = node.user_status
  if (status === 'mastered') {
    return `「${node.name}」已掌握良好（${mastery}%）。建议尝试更高难度的练习题巩固理解，并将该知识应用到实际项目中。`
  }
  if (status === 'learning') {
    if (mastery >= 60) {
      return `「${node.name}」学习进展不错（${mastery}%）。建议完成剩余练习题，重点关注薄弱环节，争取达到 80% 以上掌握度。`
    }
    return `「${node.name}」仍需加强（${mastery}%）。建议先复习基础概念，完成配套练习，必要时可观看视频讲解辅助理解。`
  }
  if (status === 'not_started') {
    return `「${node.name}」尚未开始学习。建议先了解前置知识点，然后从基础概念入手，循序渐进地学习。`
  }
  return `「${node.name}」尚未解锁。请先完成前置知识的学习，达到足够的掌握度后即可解锁。`
}

// ─── API 方法 ──────────────────────────────────────────────────────────────

/** 获取图谱数据 */
export async function fetchGraphData(): Promise<GraphData> {
  try {
    const data = await fetchJson<RawGraphData>('/api/graph/data')
    const nodes = (data.nodes || []).map(normalizeNode)
    const edges = (data.edges || []).map(normalizeEdge)
    // 如果后端返回空节点，回退到 mock 数据
    if (nodes.length === 0) {
      return MOCK_GRAPH_DATA
    }
    return { nodes, edges, stats: data.stats || computeStats(nodes) }
  } catch {
    // 回退到 mock 数据
    return MOCK_GRAPH_DATA
  }
}

/** 获取节点详情 */
export async function fetchNodeDetail(nodeId: string, graphData?: GraphData): Promise<NodeDetail> {
  try {
    const data = await fetchJson<RawNodeDetail>(`/api/graph/node/${nodeId}`)
    return {
      node: normalizeNode(data.node),
      prerequisites: data.prerequisites || [],
      successors: data.successors || [],
      ai_suggestion: String(data.ai_suggestion || ''),
    }
  } catch {
    // 回退：从已有图谱数据中推导
    const graph = graphData || MOCK_GRAPH_DATA
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) throw new Error(`未找到节点：${nodeId}`)
    const { prerequisites, successors } = deriveRelations(graph, nodeId)
    return {
      node,
      prerequisites,
      successors,
      ai_suggestion: generateAiSuggestion(node),
    }
  }
}

/** 生成/重新生成图谱 */
export async function generateGraph(subject: string = 'Python'): Promise<GraphData> {
  try {
    const data = await fetchJson<RawGraphData>('/api/graph/generate', {
      method: 'POST',
      body: JSON.stringify({ subject }),
    })
    const nodes = (data.nodes || []).map(normalizeNode)
    return {
      nodes,
      edges: (data.edges || []).map(normalizeEdge),
      stats: data.stats || computeStats(nodes),
    }
  } catch {
    return MOCK_GRAPH_DATA
  }
}

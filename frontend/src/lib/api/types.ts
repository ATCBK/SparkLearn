// API type definitions shared by real and mock implementations.

export interface Task {
  id: string
  title: string
  type: 'video' | 'reading' | 'quiz' | 'practice'
  status: 'pending' | 'in_progress' | 'completed'
  duration: number // minutes
}

export interface Resource {
  id: string
  title: string
  type: 'document' | 'ppt' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  content?: string
  sourceUrl?: string
  pptSchema?: PptDeck
  videoUrl?: string
  docmeeId?: string
  progress?: number // 0-100
}

export type PptLayout = 'cover' | 'bullets' | 'process' | 'summary'

export interface PptBullet {
  id: string
  text: string
  step: number
}

export interface PptNode {
  id: string
  label: string
  step: number
}

export interface PptNarration {
  id: string
  text: string
  target: string
}

export interface PptSlide {
  id: string
  layout: PptLayout
  title: string
  subtitle?: string
  bullets?: PptBullet[]
  nodes?: PptNode[]
  summary_points?: string[]
  narration: PptNarration[]
}

export interface PptDeck {
  deck_id: string
  theme: string
  title: string
  slides: PptSlide[]
}

export interface StudentProfile {
  id: string
  name: string
  email: string
  major: string
  grade: string
  goals: string[]
  knowledgeLevel: string
  weakPoints: string[]
  learningPreference: string[]
  cognitiveStyle: string
  dailyTime: number // minutes
  practicalAbility: string
  currentStage: string
}

export interface ProfileUpdatePayload {
  name?: string
  email?: string
  major?: string
  grade?: string
  goals?: string[]
  knowledgeLevel?: string
  weakPoints?: string[]
  learningPreference?: string[]
  cognitiveStyle?: string
  dailyTime?: number
  practicalAbility?: string
  currentStage?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  conversationId?: number
  fileNames?: string[]
}

export interface WorkshopHubEvent {
  phase: 'profile_analysis' | 'discussion' | 'synthesis' | string
  round: number
  agentId: string
  agentName: string
  agentKind: 'system' | 'custom' | string
  content: string
  timestamp: string
}

export interface TutorRole {
  id: number
  name: string
  persona: string
  background: string
  styleGuide: string
  rules: string
  enabled: boolean
}

export interface TutorConversation {
  id: number
  roleId: number | null
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface TutorFile {
  id: number
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface TaskCreatePayload {
  title: string
  type?: Task['type']
  duration?: number
}

export interface KnowledgeFile {
  id: number
  filename: string
  mimeType: string
  sizeBytes: number
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  tags: string[]
  summary: string
  chunkCount: number
  referenceCount: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeStats {
  total: number
  indexed: number
  chunks: number
  references: number
}

export interface QuizQuestion {
  id: string
  type: 'single' | 'multiple' | 'fill_blank'
  content: string
  options?: string[]
  correctAnswer: string | string[]
  explanation: string
}

export interface DashboardStats {
  totalHours: number
  taskCompletionRate: number
  quizAccuracy: number
  streakDays: number
}

export interface MasteryRecord {
  knowledgePointId: string
  knowledgePointName: string
  score: number // 0-1
  chapter: string
}

export interface ReportData {
  period: string
  stats: DashboardStats
  dailyHours: { date: string; hours: number }[]
  timeDistribution: { category: string; minutes: number }[]
  weakPoints: { name: string; score: number }[]
  aiSummary: string
}

export interface Recommendation {
  id: string
  resource: Resource
  reason: string
  category: 'today' | 'stage' | 'remedial'
}

export interface PathNode {
  id: string
  name: string
  status: 'completed' | 'current' | 'pending'
  children?: PathNode[]
}

export interface LearningPath {
  currentStage: string
  stages: { name: string; status: 'completed' | 'current' | 'pending' }[]
  knowledgeTree: PathNode[]
  knowledgeGraph?: KnowledgeGraph
}

export interface PathAdjustResult {
  previousStage: string
  currentStage: string
}

export interface PathPlanningSuggestion {
  id: number
  text: string
  desc: string
}

export interface PathPlanningResource {
  id: number
  title: string
  tag: string
  link?: string
}

export interface PathPlanningData {
  pathId: string
  target: string
  suggestions: PathPlanningSuggestion[]
  resources: PathPlanningResource[]
  createdAt: string
}

export interface PathNodeSuggestionsReq {
  nodeTitle: string
  nodeGoal: string
  nodeStatus: string
  phaseTitle: string
  target: string
}

export interface PathNodeSuggestionsResp {
  nodeTitle: string
  nodeGoal: string
  phaseTitle: string
  status: string
  suggestions: PathPlanningSuggestion[]
  resources: PathPlanningResource[]
}

export interface KnowledgeGraphNode {
  id: string
  name: string
  stage: string
  mastery: number
  status: 'completed' | 'current' | 'pending'
  prerequisites: string[]
  learningContents: string[]
  recommendedResourceTypes: string[]
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

export interface PathNodeAdvice {
  nodeId: string
  nodeName: string
  mastery: number
  suggestion: string
  plainExplanation: string
  nextActions: string[]
  learningContents: string[]
  recommendedResources: string[]
}

export interface VideoInfo {
  id: string
  title: string
  url: string
  duration: number // seconds
  createdAt: string
}

export interface ContributionDay {
  date: string // YYYY-MM-DD
  count: number // learning sessions
}

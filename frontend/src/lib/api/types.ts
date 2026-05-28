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
  type: 'document' | 'ppt' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video' | 'blog'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  content?: string
  sourceUrl?: string
  pptSchema?: PptDeck
  videoUrl?: string
  audioUrl?: string
  subtitleUrl?: string
  timelineUrl?: string
  sceneUrl?: string
  shareUrl?: string
  duration?: number
  provider?: string
  ttsProvider?: string
  hasMp4?: boolean
  muxStatus?: string
  muxMessage?: string
  docmeeId?: string
  progress?: number // 0-100
}

export interface ForumAttachment {
  id: number
  post_id: number
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface ForumPost {
  id: number
  user_id: string
  title: string
  content: string
  tags: string[]
  status: 'published' | 'hidden' | 'deleted'
  like_count: number
  comment_count: number
  favorite_count: number
  view_count: number
  liked?: boolean
  favorited?: boolean
  created_at: string
  updated_at: string
}

export interface ForumComment {
  id: number
  post_id: number
  user_id: string
  content: string
  status: 'published' | 'deleted'
  created_at: string
  updated_at: string
}

export interface TeacherRecipient {
  id: string
  name: string
  grade: string
  major: string
}

export interface TeacherMaterialFile {
  id: number
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface TeacherBroadcast {
  id: number
  title: string
  content: string
  target_type: 'all' | 'specific'
  target_student_ids: string[]
  material_file_ids: number[]
  materials: TeacherMaterialFile[]
  created_at: string
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
  phases?: Array<{ title: string; description?: string; nodes: Array<{ id: number; title: string }> }>
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
  audioUrl?: string
  subtitleUrl?: string
  timelineUrl?: string
  sceneUrl?: string
  shareUrl?: string
  duration: number // seconds
  createdAt: string
  status?: 'generating' | 'completed' | 'failed'
  provider?: string
  ttsProvider?: string
  hasMp4?: boolean
  muxStatus?: string
  muxMessage?: string
}

export interface VideoScriptSegment {
  segment_id: string
  title: string
  narration: string
  visual_hint: string
  duration_ms?: number
}

export interface VideoStyle {
  id: string
  name: string
  description: string
  accent_color: string
  bg_gradient: string
  font_family: string
  code_bg: string
  code_color: string
  card_bg: string
  tone: string
}

export interface VideoScriptSegment {
  segment_id: string
  slide_type?: string
  title: string
  subtitle?: string
  slide_text?: string[]
  narration: string
  visual_hint: string
  teacher_note?: string
  interaction?: string
  code?: string
  mistake?: string
  answer?: string
  duration_ms?: number
}

export interface VideoPolishResult {
  polishId: string
  title: string
  polishedPrompt: string
  scriptOutline: VideoScriptSegment[]
  estimatedDurationSec: number
  voice: string
  styleId?: string
  styleName?: string
  contentSource?: string
}

export interface VideoGenerateOptions {
  prompt: string
  polish?: VideoPolishResult
  voice?: string
  durationSec?: number
  targetLevel?: string
  styleId?: string
}

export interface VideoGenerateEvent {
  type: string
  payload: Record<string, unknown>
}

export interface ContributionDay {
  date: string // YYYY-MM-DD
  count: number // learning sessions
}

// ─── Agent Pet Types ─────────────────────────────────────────────────────────

export interface AgentPet {
  id: string
  name: string
  avatar: 'fox' | 'owl' | 'robot' | 'cat' | 'dragon' | 'penguin' | 'bunny' | 'panda'
  personality: 'concise' | 'verbose' | 'encouraging'
  level: number
  xp: number
  next_level_xp: number | null
  unlocked_abilities: string[]
  created_at: string
  updated_at: string
}

export interface AgentTaskStep {
  step: number
  action: string
  description: string
  time: string
}

export interface AgentTask {
  task_id: string
  task_type: 'search' | 'summarize' | 'compare' | 'recommend'
  input_text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result: AgentSearchResult | AgentSummaryResult | AgentCompareResult | null
  error_message: string | null
  feedback: 'useful' | 'not_useful' | null
  steps?: AgentTaskStep[]
  created_at: string
  updated_at: string
}

export interface AgentSearchResult {
  items: Array<{
    title: string
    summary: string
    url: string
    source: string
  }>
}

export interface AgentSummaryResult {
  topic: string
  key_points: string[]
  conclusion: string
}

export interface AgentCompareResult {
  items: Array<{
    source: string
    explanation: string
    url: string
  }>
  comparison: string
}

export interface AgentTaskList {
  items: AgentTask[]
  total: number
  page: number
  page_size: number
}

export interface AdoptPetPayload {
  name: string
  avatar: string
  personality: string
}

export interface CreateAgentTaskPayload {
  task_type: string
  input_text: string
}

export interface BookmarkPayload {
  task_id: string
  item_index: number
  title: string
  url: string
  summary: string
}

// ─── Digital Human Types ────────────────────────────────────────────────────────

export interface DigitalHumanMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface MemoryLoadResult {
  memory_id: string
  video_title: string
  segment_count: number
  greeting: string
}

export interface MemoryInfo {
  memory_id: string
  video_id: string
  video_title: string
  segment_count: number
  created_at: string
  ttl_sec: number
}

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
  type: 'document' | 'ppt' | 'mindmap' | 'quiz' | 'reading' | 'code'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  content?: string
  videoUrl?: string
  docmeeId?: string
  progress?: number // 0-100
}

export interface StudentProfile {
  id: string
  name: string
  major: string
  grade: string
  goals: string[]
  knowledgeLevel: string
  weakPoints: string[]
  learningPreference: string[]
  cognitiveStyle: string
  dailyTime: number // minutes
  practicalAbility: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  conversationId?: number
  fileNames?: string[]
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

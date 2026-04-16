// API 类型定义 - 唯一真相源
// Mock 和 Real 实现都必须遵循这些类型签名

export interface Task {
  id: string
  title: string
  type: 'video' | 'reading' | 'quiz' | 'practice'
  status: 'pending' | 'in_progress' | 'completed'
  duration: number // 分钟
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
  dailyTime: number // 分钟
  practicalAbility: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
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
  duration: number // 秒
  createdAt: string
}

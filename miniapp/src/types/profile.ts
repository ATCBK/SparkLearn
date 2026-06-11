export type LearningProfile = {
  name?: string
  nickname?: string
  goal?: string | string[]
  knowledge_level?: string
  weak_points?: string | string[]
  learning_preference?: string | string[]
  major?: string
}

export type MasteryItem = {
  knowledge_point_id?: string
  knowledge_point_name?: string
  name?: string
  score?: number
  mastery?: number
}

export type DashboardStats = {
  streak_days?: number
  study_days_this_week?: number
  total_questions?: number
}

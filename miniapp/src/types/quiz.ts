export type QuizType = 'single' | 'multiple' | 'fill_blank'

export type QuizQuestion = {
  id: string
  type: QuizType
  content: string
  options?: string[] | null
  correct_answer?: string | string[]
  explanation?: string
  knowledge_point_id?: string
  knowledge_point_name?: string
}

export type SubmitQuizResult = {
  quiz_id: string
  correct: boolean
  correct_answer?: string | string[]
  explanation?: string
  knowledge_point_id?: string
  knowledge_point_name?: string
  mastery_delta?: number
  current_mastery?: number
}

export type QuizStats = {
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export type QuizRecord = {
  quiz_id: string
  at?: string
  answer?: string | string[]
  correct?: boolean
  correct_answer?: string | string[]
  question?: QuizQuestion
  knowledge_point_name?: string
}

export type WrongQuizItem = {
  quiz_id: string
  content?: string
  count?: number
  user_answer?: string | string[]
  correct_answer?: string | string[]
  question?: QuizQuestion
}

export type FavoriteQuizItem = {
  quiz_id: string
  created_at?: string
  question?: QuizQuestion
}

export type QuizAskAiContext = {
  source: 'quiz_result' | 'wrong_detail' | 'favorite_detail'
  quizId: string
  question: string
  questionType?: QuizType
  userAnswer?: string | string[]
  correctAnswer?: string | string[]
  explanation?: string
  knowledgePointName?: string
}

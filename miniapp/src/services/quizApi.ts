import { request } from './apiClient'
import type { FavoriteQuizItem, QuizQuestion, QuizRecord, QuizStats, SubmitQuizResult, WrongQuizItem } from '../types/quiz'

function normalizeQuestions(data: any): QuizQuestion[] {
  const nested = data?.data
  const source = Array.isArray(data)
    ? data
    : data?.questions
      || data?.items
      || data?.quizzes
      || (Array.isArray(nested) ? nested : nested?.questions || nested?.items || nested?.quizzes)
      || data?.result
      || []
  return (Array.isArray(source) ? source : []).map((item) => ({
    id: String(item.id || item.quiz_id || ''),
    type: item.type || 'single',
    content: String(item.content || item.question || item.title || ''),
    options: item.options || null,
    correct_answer: item.correct_answer ?? item.correctAnswer,
    explanation: item.explanation || item.analysis || item.reason,
    knowledge_point_id: item.knowledge_point_id || item.knowledgePointId,
    knowledge_point_name: item.knowledge_point_name || item.knowledgePointName
  })).filter((item) => item.id && item.content)
}

export async function getQuiz(chapter: string, count: number) {
  const data = await request<any>({
    url: `/api/quiz?chapter=${encodeURIComponent(chapter)}&count=${count}&use_llm=true`
  })
  return normalizeQuestions(data)
}

export function submitQuiz(quizId: string, answer: string | string[]) {
  return request<SubmitQuizResult>({
    url: '/api/quiz/submit',
    method: 'POST',
    data: { quiz_id: quizId, answer }
  })
}

export function setFavorite(quizId: string, favorite: boolean) {
  return request<{ quiz_id: string; favorite: boolean }>({
    url: '/api/quiz/favorites',
    method: 'POST',
    data: { quiz_id: quizId, favorite }
  })
}

export function getQuizStats() {
  return request<QuizStats>({ url: '/api/quiz/records/stats' })
}

export function getQuizRecords() {
  return request<QuizRecord[]>({ url: '/api/quiz/records' })
}

export function deleteQuizRecord(quizId: string) {
  return request<{ removed_count: number }>({ url: `/api/quiz/records/${quizId}`, method: 'DELETE' })
}

export function getWrongQuiz() {
  return request<WrongQuizItem[]>({ url: '/api/quiz/wrong' })
}

export function deleteWrongQuiz(quizId: string) {
  return request<{ removed_count: number }>({ url: `/api/quiz/wrong/${quizId}`, method: 'DELETE' })
}

export function getFavorites() {
  return request<FavoriteQuizItem[]>({ url: '/api/quiz/favorites' })
}

import Taro from '@tarojs/taro'
import type { QuizAskAiContext, QuizQuestion, SubmitQuizResult } from '../types/quiz'
import type { TutorMessage } from '../types/tutor'

export const TOKEN_KEY = 'sparklearn_token'
export const QUIZ_ASK_AI_KEY = 'sparklearn_quiz_ask_ai'
export const QUIZ_DRAFT_KEY = 'sparklearn_quiz_draft'
export const TUTOR_DRAFT_KEY = 'sparklearn_tutor_draft'

export type QuizDraft = {
  chapter: string
  count: number
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, string | string[]>
  results: Record<string, SubmitQuizResult>
  favorites: Record<string, boolean>
}

export type TutorDraft = {
  conversationId?: number
  currentRoleId?: number
  messages: TutorMessage[]
  question: string
  modelName?: string
  workshopEnabled: boolean
  mcpEnabled: boolean
  webSearchEnabled?: boolean
  imageModeEnabled?: boolean
  videoModeEnabled?: boolean
  trustModeEnabled?: boolean
  fileIds: number[]
}

export function getToken() {
  try {
    return Taro.getStorageSync<string>(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  Taro.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  Taro.removeStorageSync(TOKEN_KEY)
}

export function setAskAiContext(context: QuizAskAiContext) {
  Taro.setStorageSync(QUIZ_ASK_AI_KEY, context)
}

export function consumeAskAiContext(): QuizAskAiContext | undefined {
  try {
    const value = Taro.getStorageSync<QuizAskAiContext>(QUIZ_ASK_AI_KEY)
    if (value) {
      Taro.removeStorageSync(QUIZ_ASK_AI_KEY)
    }
    return value || undefined
  } catch {
    return undefined
  }
}

export function getQuizDraft(): QuizDraft | undefined {
  try {
    const value = Taro.getStorageSync<QuizDraft>(QUIZ_DRAFT_KEY)
    if (!value || !Array.isArray(value.questions)) return undefined
    return {
      chapter: value.chapter || 'Python 鍩虹',
      count: Number(value.count) || 4,
      questions: value.questions || [],
      currentIndex: Math.max(0, Number(value.currentIndex) || 0),
      answers: value.answers || {},
      results: value.results || {},
      favorites: value.favorites || {}
    }
  } catch {
    return undefined
  }
}

export function setQuizDraft(draft: QuizDraft) {
  Taro.setStorageSync(QUIZ_DRAFT_KEY, draft)
}

export function getTutorDraft(): TutorDraft | undefined {
  try {
    const value = Taro.getStorageSync<TutorDraft>(TUTOR_DRAFT_KEY)
    if (!value || !Array.isArray(value.messages)) return undefined
    return {
      conversationId: value.conversationId,
      currentRoleId: value.currentRoleId,
      messages: value.messages.map((message) => ({ ...message, streaming: false })),
      question: value.question || '',
      modelName: value.modelName || 'Lite',
      workshopEnabled: value.workshopEnabled !== false,
      mcpEnabled: Boolean(value.mcpEnabled),
      webSearchEnabled: Boolean(value.webSearchEnabled),
      imageModeEnabled: Boolean(value.imageModeEnabled),
      videoModeEnabled: Boolean(value.videoModeEnabled),
      trustModeEnabled: value.trustModeEnabled !== false,
      fileIds: Array.isArray(value.fileIds) ? value.fileIds : []
    }
  } catch {
    return undefined
  }
}

export function setTutorDraft(draft: TutorDraft) {
  Taro.setStorageSync(TUTOR_DRAFT_KEY, {
    ...draft,
    messages: draft.messages.map((message) => ({ ...message, streaming: false }))
  })
}

import type { QuizAskAiContext } from '../types/quiz'

export function stringifyAnswer(answer?: string | string[]) {
  if (Array.isArray(answer)) {
    return answer.join('、')
  }
  return answer || '未作答'
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function percentText(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0%'
  }
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}%`
}

export function buildAskAiPrompt(context: QuizAskAiContext) {
  return [
    '请讲解这道题：',
    '',
    `题目：${context.question}`,
    `题型：${context.questionType || '未知'}`,
    `知识点：${context.knowledgePointName || '未标注'}`,
    `我的答案：${stringifyAnswer(context.userAnswer)}`,
    `正确答案：${stringifyAnswer(context.correctAnswer)}`,
    `解析：${context.explanation || '暂无解析'}`,
    '',
    '请先指出关键考点，再说明我的答案为什么对或错，最后给一个类似练习建议。'
  ].join('\n')
}

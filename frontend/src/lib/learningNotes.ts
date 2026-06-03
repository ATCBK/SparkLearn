'use client'

export type NoteSourceType = 'resource' | 'task' | 'question' | 'course' | 'space' | 'knowledge' | 'practice' | 'manual'

export interface NoteSource {
  type: NoteSourceType
  id?: string
  title: string
  href: string
}

export interface LearningNote {
  id: string
  title: string
  content: string
  source: NoteSource
  tags: string[]
  personalizationEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface MatchedLearningNote {
  note: LearningNote
  score: number
  keywords: string[]
}

export const LEARNING_NOTES_STORAGE_KEY = 'sparklearn_learning_notes'

export const noteSourceTypeLabel: Record<NoteSourceType, string> = {
  resource: '资源',
  task: '任务',
  question: '题目',
  course: '课程',
  space: '学习空间',
  knowledge: '知识库',
  practice: '练习',
  manual: '手动',
}

export function readLearningNotes(): LearningNote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LEARNING_NOTES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((note) => ({
      ...note,
      tags: Array.isArray(note.tags) ? note.tags : [],
      personalizationEnabled: note.personalizationEnabled !== false,
    }))
  } catch {
    return []
  }
}

export function writeLearningNotes(notes: LearningNote[]) {
  window.localStorage.setItem(LEARNING_NOTES_STORAGE_KEY, JSON.stringify(notes))
  window.dispatchEvent(new CustomEvent('learning-notes-updated', { detail: { count: notes.length } }))
}

export function tokenizeLearningText(text: string) {
  const normalized = text.toLowerCase()
  const ascii = normalized.match(/[a-z0-9_+#.-]{2,}/g) || []
  const chinese = normalized.match(/[\u4e00-\u9fa5]{2,}/g) || []
  const chinesePairs = chinese.flatMap((chunk) => {
    const pairs: string[] = []
    for (let i = 0; i < chunk.length - 1; i += 1) pairs.push(chunk.slice(i, i + 2))
    return pairs
  })
  const stop = new Set(['这个', '那个', '什么', '怎么', '为什么', '还是', '感觉', '学习', '问题', '内容', '笔记', '当前'])
  return [...new Set([...ascii, ...chinese, ...chinesePairs].filter((word) => !stop.has(word)))]
}

export function matchPersonalizedNotes(notes: LearningNote[], query: string, limit = 5): MatchedLearningNote[] {
  const queryTokens = tokenizeLearningText(query)
  if (queryTokens.length === 0) return []

  return notes
    .filter((note) => note.personalizationEnabled !== false)
    .map((note) => {
      const noteText = [note.title, note.content, note.source.title, ...note.tags].join(' ')
      const noteTokens = tokenizeLearningText(noteText)
      const matched = queryTokens.filter((token) => noteTokens.includes(token) || noteText.toLowerCase().includes(token))
      const tagBoost = note.tags.filter((tag) => query.toLowerCase().includes(tag.toLowerCase())).length * 2
      const sourceBoost = note.source.title && query.includes(note.source.title) ? 2 : 0
      return {
        note,
        score: matched.length + tagBoost + sourceBoost,
        keywords: [...new Set(matched.concat(note.tags.filter((tag) => query.includes(tag))).slice(0, 6))],
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime())
    .slice(0, limit)
}

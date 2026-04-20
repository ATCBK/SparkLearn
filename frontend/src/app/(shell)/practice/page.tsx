'use client'

import { useEffect, useReducer, useState } from 'react'
import { api, QuizQuestion } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { cn } from '@/lib/utils/cn'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'

type QuizState = {
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, string[]>
  submitted: Record<string, boolean>
  results: Record<string, boolean>
  explanations: Record<string, string>
  correctAnswers: Record<string, string | string[]>
  judgeModes: Record<string, string>
}

type QuizAction =
  | { type: 'LOAD'; questions: QuizQuestion[] }
  | { type: 'SELECT'; questionId: string; answer: string }
  | {
      type: 'SUBMIT'
      questionId: string
      correct: boolean
      explanation: string
      correctAnswer: string | string[]
      judgeMode?: string
    }
  | { type: 'NEXT' }

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, questions: action.questions }
    case 'SELECT': {
      const q = state.questions.find((item) => item.id === action.questionId)
      const current = state.answers[action.questionId] || []
      const newAnswers =
        q?.type === 'multiple'
          ? current.includes(action.answer)
            ? current.filter((a) => a !== action.answer)
            : [...current, action.answer]
          : [action.answer]
      return { ...state, answers: { ...state.answers, [action.questionId]: newAnswers } }
    }
    case 'SUBMIT':
      return {
        ...state,
        submitted: { ...state.submitted, [action.questionId]: true },
        results: { ...state.results, [action.questionId]: action.correct },
        explanations: { ...state.explanations, [action.questionId]: action.explanation },
        correctAnswers: { ...state.correctAnswers, [action.questionId]: action.correctAnswer },
        judgeModes: { ...state.judgeModes, [action.questionId]: action.judgeMode || 'rule' },
      }
    case 'NEXT':
      return { ...state, currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1) }
  }
}

const initialState: QuizState = {
  questions: [],
  currentIndex: 0,
  answers: {},
  submitted: {},
  results: {},
  explanations: {},
  correctAnswers: {},
  judgeModes: {},
}

export default function PracticePage() {
  const [tab, setTab] = useState<'practice' | 'mistakes' | 'favorites'>('practice')
  const [state, dispatch] = useReducer(quizReducer, initialState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function fetchData() {
    try {
      setLoading(true)
      setError(null)
      const questions = await api.getQuizQuestions('函数')
      dispatch({ type: 'LOAD', questions })
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-full" />
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <Skeleton className="h-96 rounded-[20px]" />
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
      </div>
    )
  }

  if (error) return <ErrorState type="server" onRetry={fetchData} />

  const current = state.questions[state.currentIndex]
  if (!current) return null

  const selected = state.answers[current.id] || []
  const isSubmitted = state.submitted[current.id]
  const isCorrect = state.results[current.id]

  async function checkAnswer() {
    try {
      setSubmitting(true)
      setActionError(null)
      const answerPayload = current.type === 'multiple' ? selected : selected[0] || ''
      const judged = await api.submitQuizAnswer(current.id, answerPayload)
      dispatch({
        type: 'SUBMIT',
        questionId: current.id,
        correct: judged.correct,
        explanation: judged.explanation,
        correctAnswer: judged.correctAnswer,
        judgeMode: judged.judgeMode,
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '判题失败，请检查后端服务')
    } finally {
      setSubmitting(false)
    }
  }

  const correctCount = Object.values(state.results).filter(Boolean).length
  const doneCount = Object.keys(state.results).length
  const accuracy = doneCount > 0 ? Math.round((correctCount / doneCount) * 100) : 0

  function isOptionCorrect(opt: string): boolean {
    const answer = state.correctAnswers[current.id]
    if (Array.isArray(answer)) return answer.includes(opt)
    return answer === opt
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">练习与错题</h1>
        <p className="text-body text-ink-secondary mt-1">巩固知识，提升技能</p>
        {actionError && <p className="text-xs text-danger mt-1">{actionError}</p>}
      </div>

      <div className="flex gap-2">
        {[
          { key: 'practice' as const, label: '练习' },
          { key: 'mistakes' as const, label: '错题本' },
          { key: 'favorites' as const, label: '收藏' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 rounded-pill text-small font-medium transition-colors',
              tab === t.key ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'practice' && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <Card className="p-8">
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="info">第 {state.currentIndex + 1} 题</Badge>
              <span className="text-caption text-ink-tertiary">/ {state.questions.length}</span>
            </div>

            <h3 className="text-h3 text-ink mb-6">{current.content}</h3>

            <div className="space-y-3 mb-6">
              {current.type === 'fill_blank' ? (
                <input
                  type="text"
                  placeholder="输入你的答案..."
                  value={selected[0] || ''}
                  onChange={(e) => dispatch({ type: 'SELECT', questionId: current.id, answer: e.target.value })}
                  disabled={isSubmitted}
                  className="w-full h-12 px-4 rounded-[12px] border border-black/[0.08] bg-bg text-body text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              ) : (
                current.options?.map((opt, i) => {
                  const optLabel = String.fromCharCode(65 + i)
                  const isSelected = selected.includes(opt)
                  const showCorrect = isSubmitted && isOptionCorrect(opt)
                  const showWrong = isSubmitted && isSelected && !showCorrect

                  return (
                    <button
                      key={opt}
                      onClick={() => !isSubmitted && dispatch({ type: 'SELECT', questionId: current.id, answer: opt })}
                      disabled={isSubmitted}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] border text-left transition-all',
                        !isSubmitted && !isSelected && 'border-black/[0.08] hover:border-blue/30 hover:bg-blue-light/50',
                        !isSubmitted && isSelected && 'border-blue bg-blue-light',
                        showCorrect && 'border-success bg-success/10',
                        showWrong && 'border-danger bg-danger/10',
                      )}
                    >
                      <span
                        className={cn(
                          'w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 text-small font-medium',
                          !isSubmitted && isSelected && 'border-blue bg-blue text-white',
                          !isSubmitted && !isSelected && 'border-ink-disabled text-ink-secondary',
                          showCorrect && 'border-success bg-success text-white',
                          showWrong && 'border-danger bg-danger text-white',
                        )}
                      >
                        {showCorrect ? '✓' : showWrong ? '✕' : optLabel}
                      </span>
                      <span className="text-body text-ink">{opt}</span>
                    </button>
                  )
                })
              )}
            </div>

            {isSubmitted && (
              <div className={cn('p-4 rounded-[12px] mb-6', isCorrect ? 'bg-success/10' : 'bg-warning/10')}>
                <div className="flex items-center gap-2 mb-2">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-body font-medium text-success">回答正确！</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-warning" />
                      <span className="text-body font-medium text-warning">还可以再想想</span>
                    </>
                  )}
                </div>
                <p className="text-small text-ink-secondary">{state.explanations[current.id] || current.explanation}</p>
                {state.judgeModes[current.id] && (
                  <p className="text-micro text-ink-tertiary mt-1">判题模式：{state.judgeModes[current.id]}</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {!isSubmitted ? (
                <Button onClick={() => void checkAnswer()} disabled={selected.length === 0 || submitting}>
                  提交答案
                </Button>
              ) : (
                <Button onClick={() => dispatch({ type: 'NEXT' })}>
                  下一题
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-5 text-center">
              <div className="text-h1 text-ink mb-1">{accuracy}%</div>
              <p className="text-caption text-ink-tertiary">正确率</p>
            </Card>

            <Card className="p-5">
              <h4 className="text-small font-semibold text-ink mb-3">题号导航</h4>
              <div className="grid grid-cols-5 gap-2">
                {state.questions.map((q, i) => {
                  const done = state.submitted[q.id]
                  const correct = state.results[q.id]
                  const isCurrent = i === state.currentIndex
                  return (
                    <button
                      key={q.id}
                      className={cn(
                        'w-full aspect-square rounded-lg text-caption font-medium transition-colors',
                        isCurrent && 'ring-2 ring-blue',
                        done && correct && 'bg-success/10 text-success',
                        done && !correct && 'bg-danger/10 text-danger',
                        !done && 'bg-bg-hover text-ink-tertiary hover:bg-bg-hover',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'mistakes' && (
        <Card className="p-8 text-center">
          <p className="text-body text-ink-secondary">还没有错题记录，先做几道题吧。</p>
        </Card>
      )}

      {tab === 'favorites' && (
        <Card className="p-8 text-center">
          <p className="text-body text-ink-secondary">还没有收藏的题目。</p>
        </Card>
      )}
    </div>
  )
}

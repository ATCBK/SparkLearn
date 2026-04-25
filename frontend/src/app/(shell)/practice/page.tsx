'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, QuizQuestion } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { cn } from '@/lib/utils/cn'
import { CheckCircle2, XCircle, ChevronRight, Play, Bookmark, BookmarkCheck, Trash2 } from 'lucide-react'

type TabKey = 'practice' | 'mistakes' | 'favorites'

type JudgeInfo = {
  submitted: boolean
  correct: boolean
  explanation: string
  correctAnswer: string | string[]
  judgeMode?: string
}

type WrongItem = {
  quizId: string
  content: string
  userAnswer: string | string[] | null
  correctAnswer: string | string[] | null
  count: number
}

type FavoriteItem = {
  quizId: string
  question?: Record<string, unknown>
  createdAt: string
}

export default function PracticePage() {
  const [tab, setTab] = useState<TabKey>('practice')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [judges, setJudges] = useState<Record<string, JudgeInfo>>({})

  const [wrongItems, setWrongItems] = useState<WrongItem[]>([])
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const current = questions[currentIndex]

  const favoriteIdSet = useMemo(() => new Set(favorites.map((f) => f.quizId)), [favorites])

  async function loadWrongAndFavorites() {
    try {
      const [wrong, favs] = await Promise.all([api.getWrongQuizItems(), api.getQuizFavorites()])
      setWrongItems(wrong)
      setFavorites(favs)
    } catch {
      // keep silent: non-critical side panels
    }
  }

  async function loadInitial() {
    try {
      setLoading(true)
      setError(null)
      const [qs] = await Promise.all([api.getQuizQuestions('函数')])
      setQuestions(qs)
      setCurrentIndex(0)
      await loadWrongAndFavorites()
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInitial()
  }, [])

  function selectedAnswers(questionId: string): string[] {
    return answers[questionId] || []
  }

  function setSelected(question: QuizQuestion, value: string) {
    if (judges[question.id]?.submitted) return
    setAnswers((prev) => {
      const currentSelected = prev[question.id] || []
      const next =
        question.type === 'multiple'
          ? currentSelected.includes(value)
            ? currentSelected.filter((x) => x !== value)
            : [...currentSelected, value]
          : [value]
      return { ...prev, [question.id]: next }
    })
  }

  async function submitCurrent() {
    if (!current) return
    const selected = selectedAnswers(current.id)
    if (selected.length === 0) return

    try {
      setSubmitting(true)
      setActionError(null)
      const answerPayload = current.type === 'multiple' ? selected : selected[0] || ''
      const judged = await api.submitQuizAnswer(current.id, answerPayload)
      setJudges((prev) => ({
        ...prev,
        [current.id]: {
          submitted: true,
          correct: judged.correct,
          explanation: judged.explanation,
          correctAnswer: judged.correctAnswer,
          judgeMode: judged.judgeMode,
        },
      }))
      await loadWrongAndFavorites()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '判题失败，请检查后端服务')
    } finally {
      setSubmitting(false)
    }
  }

  async function continueChallenge() {
    try {
      setLoadingMore(true)
      setActionError(null)
      const nextBatch = await api.getQuizQuestions('函数')
      setQuestions((prev) => {
        const nextStart = prev.length
        setCurrentIndex(nextStart)
        return [...prev, ...nextBatch]
      })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '继续出题失败，请检查后端服务')
    } finally {
      setLoadingMore(false)
    }
  }

  async function toggleFavorite(quizId: string) {
    try {
      setActionError(null)
      const next = !favoriteIdSet.has(quizId)
      await api.setQuizFavorite(quizId, next)
      await loadWrongAndFavorites()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '收藏操作失败，请检查后端服务')
    }
  }

  async function removeWrongItem(quizId: string) {
    try {
      setActionError(null)
      await api.deleteWrongQuizItem(quizId)
      await loadWrongAndFavorites()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除错题失败，请检查后端服务')
    }
  }

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

  if (error) return <ErrorState type="server" onRetry={loadInitial} />
  if (!current) return null

  const selected = selectedAnswers(current.id)
  const judge = judges[current.id]
  const isSubmitted = !!judge?.submitted
  const isCorrect = !!judge?.correct

  const isAtQuestionEnd = currentIndex >= questions.length - 1

  const doneCount = Object.values(judges).filter((j) => j.submitted).length
  const correctCount = Object.values(judges).filter((j) => j.submitted && j.correct).length
  const accuracy = doneCount > 0 ? Math.round((correctCount / doneCount) * 100) : 0

  function optionIsCorrect(opt: string): boolean {
    const answer = judge?.correctAnswer
    if (Array.isArray(answer)) return answer.includes(opt)
    return answer === opt
  }

  function renderPractice() {
    return (
      <div className="grid grid-cols-[1fr_280px] gap-6">
        <Card className="p-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Badge variant="info">第 {currentIndex + 1} 题</Badge>
              <span className="text-caption text-ink-tertiary">总题量：{questions.length}</span>
            </div>
            <Button
              size="sm"
              variant={favoriteIdSet.has(current.id) ? 'secondary' : 'primary'}
              onClick={() => void toggleFavorite(current.id)}
            >
              {favoriteIdSet.has(current.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              {favoriteIdSet.has(current.id) ? '已收藏' : '加入收藏'}
            </Button>
          </div>

          <h3 className="text-h3 text-ink mb-6">{current.content}</h3>

          <div className="space-y-3 mb-6">
            {current.type === 'fill_blank' ? (
              <input
                type="text"
                placeholder="输入你的答案..."
                value={selected[0] || ''}
                onChange={(e) => setSelected(current, e.target.value)}
                disabled={isSubmitted}
                className="w-full h-12 px-4 rounded-[12px] border border-black/[0.08] bg-bg text-body text-ink placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-blue/20"
              />
            ) : (
              current.options?.map((opt, i) => {
                const label = String.fromCharCode(65 + i)
                const selectedOpt = selected.includes(opt)
                const showCorrect = isSubmitted && optionIsCorrect(opt)
                const showWrong = isSubmitted && selectedOpt && !showCorrect
                return (
                  <button
                    key={opt}
                    onClick={() => setSelected(current, opt)}
                    disabled={isSubmitted}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] border text-left transition-all',
                      !isSubmitted && !selectedOpt && 'border-black/[0.08] hover:border-blue/30 hover:bg-blue-light/50',
                      !isSubmitted && selectedOpt && 'border-blue bg-blue-light',
                      showCorrect && 'border-success bg-success/10',
                      showWrong && 'border-danger bg-danger/10',
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 text-small font-medium',
                        !isSubmitted && selectedOpt && 'border-blue bg-blue text-white',
                        !isSubmitted && !selectedOpt && 'border-ink-disabled text-ink-secondary',
                        showCorrect && 'border-success bg-success text-white',
                        showWrong && 'border-danger bg-danger text-white',
                      )}
                    >
                      {showCorrect ? '✓' : showWrong ? '✕' : label}
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
                    <span className="text-body font-medium text-success">回答正确</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-warning" />
                    <span className="text-body font-medium text-warning">回答不正确</span>
                  </>
                )}
              </div>
              <p className="text-small text-ink-secondary">{judge?.explanation || current.explanation}</p>
              {judge?.judgeMode && <p className="text-micro text-ink-tertiary mt-1">判题模式：{judge.judgeMode}</p>}
            </div>
          )}

          <div className="flex gap-3">
            {!isSubmitted ? (
              <Button onClick={() => void submitCurrent()} disabled={selected.length === 0 || submitting}>
                提交答案
              </Button>
            ) : !isAtQuestionEnd ? (
              <Button onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))}>
                下一题
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={() => void continueChallenge()} disabled={loadingMore}>
                <Play className="w-4 h-4" />
                {loadingMore ? '正在实时生成新题...' : '继续挑战（实时生成新题）'}
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
              {questions.map((q, i) => {
                const done = judges[q.id]?.submitted
                const correct = judges[q.id]?.correct
                const isCurrent = i === currentIndex
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
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
    )
  }

  function renderMistakes() {
    return (
      <Card className="p-6 space-y-3">
        {wrongItems.length === 0 ? (
          <p className="text-body text-ink-secondary">还没有错题记录，先去闯关吧。</p>
        ) : (
          wrongItems.map((w) => (
            <div key={w.quizId} className="rounded-[12px] border border-black/[0.08] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-body text-ink">{w.content}</p>
                <Button variant="ghost" size="sm" onClick={() => void removeWrongItem(w.quizId)}>
                  <Trash2 className="w-4 h-4" />
                  删除
                </Button>
              </div>
              <p className="text-small text-ink-secondary mt-2">你的答案：{JSON.stringify(w.userAnswer)}</p>
              <p className="text-small text-ink-secondary">正确答案：{JSON.stringify(w.correctAnswer)}</p>
              <p className="text-micro text-ink-tertiary mt-1">错误次数：{w.count}</p>
            </div>
          ))
        )}
      </Card>
    )
  }

  function renderFavorites() {
    return (
      <Card className="p-6 space-y-3">
        {favorites.length === 0 ? (
          <p className="text-body text-ink-secondary">还没有收藏的题目。</p>
        ) : (
          favorites.map((f) => (
            <div key={f.quizId} className="rounded-[12px] border border-black/[0.08] p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-body text-ink">{String((f.question?.content as string) || '题目内容')}</p>
                <p className="text-micro text-ink-tertiary mt-1">收藏时间：{f.createdAt}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void toggleFavorite(f.quizId)}>
                取消收藏
              </Button>
            </div>
          ))
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-ink">练习与错题</h1>
        <p className="text-body text-ink-secondary mt-1">大模型实时生成，基于你的画像与作答轨迹无限个性化出题</p>
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
            onClick={() => {
              setTab(t.key)
              if (t.key !== 'practice') void loadWrongAndFavorites()
            }}
            className={cn(
              'px-4 py-2 rounded-pill text-small font-medium transition-colors',
              tab === t.key ? 'bg-blue text-white' : 'bg-bg-hover text-ink-secondary hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'practice' && renderPractice()}
      {tab === 'mistakes' && renderMistakes()}
      {tab === 'favorites' && renderFavorites()}
    </div>
  )
}

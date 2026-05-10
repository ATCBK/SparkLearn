'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bookmark, CheckCircle2, Circle, XCircle } from 'lucide-react'
import { api, QuizQuestion } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'

export default function PracticePage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState<string | string[]>('')
  const [result, setResult] = useState<{ correct: boolean; explanation: string; correctAnswer: string | string[] } | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const current = questions[idx]

  useEffect(() => {
    let mounted = true
    Promise.allSettled([api.getQuizQuestions('函数'), api.getQuizFavorites()]).then(([q, f]) => {
      if (!mounted) return
      if (q.status === 'fulfilled') setQuestions(q.value)
      if (f.status === 'fulfilled') setFavorites(new Set(f.value.map(x => x.quizId)))
    })
    return () => {
      mounted = false
    }
  }, [])

  const progress = useMemo(() => questions.length ? Math.round(((idx + 1) / questions.length) * 100) : 0, [idx, questions.length])

  async function submit() {
    if (!current || !answer) return
    const res = await api.submitQuizAnswer(current.id, answer)
    setResult(res)
  }

  async function toggleFavorite() {
    if (!current) return
    const next = !favorites.has(current.id)
    await api.setQuizFavorite(current.id, next)
    setFavorites(prev => {
      const copy = new Set(prev)
      if (next) copy.add(current.id)
      else copy.delete(current.id)
      return copy
    })
  }

  return (
    <div>
      <PageHead
        eyebrow="资源与练习 / 练习评测"
        title="练习评测"
        description="提交后系统会判题、沉淀错题、更新掌握度，并触发补弱资源推荐。"
        actions={<div className="flex gap-2"><ProtoButton href="/practice/mistakes" variant="secondary">错题本</ProtoButton><ProtoButton href="/practice/favorites" variant="tertiary">收藏题目</ProtoButton></div>}
        chips={[
          { value: `${questions.length || 8}题`, label: '本组练习' },
          { value: `${progress}%`, label: '当前进度' },
          { value: '函数', label: '知识点' },
        ]}
      />

      <div className="grid grid-cols-[1fr_300px] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          {current ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <Pill tone="blue">第 {idx + 1} 题</Pill>
                <button onClick={() => void toggleFavorite()} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-small font-bold ${favorites.has(current.id) ? 'bg-orange-light text-orange' : 'bg-[#f2f6fb] text-muted'}`}>
                  <Bookmark className="h-4 w-4" />{favorites.has(current.id) ? '已收藏' : '收藏'}
                </button>
              </div>
              <h2 className="text-h2 font-bold leading-7 text-ink">{current.content}</h2>
              <div className="mt-4 grid gap-2">
                {(current.options || ['A', 'B', 'C', 'D']).map((option) => (
                  <button key={option} onClick={() => { setAnswer(option); setResult(null) }} className={`rounded-[12px] border p-4 text-left text-small font-bold ${answer === option ? 'border-blue bg-blue-light text-blue' : 'border-line bg-white text-ink hover:border-blue'}`}>
                    {option}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <ProtoButton onClick={() => void submit()} disabled={!answer}>提交判题</ProtoButton>
                <ProtoButton variant="tertiary" onClick={() => { setIdx(Math.min(questions.length - 1, idx + 1)); setAnswer(''); setResult(null) }}>下一题</ProtoButton>
              </div>
              {result && (
                <SoftCard className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    {result.correct ? <CheckCircle2 className="h-5 w-5 text-green" /> : <XCircle className="h-5 w-5 text-red" />}
                    <b className={result.correct ? 'text-green' : 'text-red'}>{result.correct ? '回答正确' : '需要补弱'}</b>
                  </div>
                  <p className="text-small leading-6 text-muted">{result.explanation || current.explanation || '系统已记录本次作答结果。'}</p>
                  {!result.correct && (
                    <div className="mt-3 grid gap-2">
                      <Pill tone="orange">已写入错题本</Pill>
                      <Pill tone="blue">将影响首页推荐资源</Pill>
                      <Pill tone="purple">将影响学习画像薄弱点</Pill>
                    </div>
                  )}
                </SoftCard>
              )}
            </div>
          ) : (
            <SoftCard className="text-small text-muted">正在生成练习题...</SoftCard>
          )}
        </ProtoCard>

        <ProtoCard>
          <h2 className="mb-3 text-h2 font-bold text-ink">答题导航</h2>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, i) => (
              <button key={q.id} onClick={() => { setIdx(i); setAnswer(''); setResult(null) }} className={`grid h-10 place-items-center rounded-[10px] border text-small font-bold ${i === idx ? 'border-blue bg-blue-light text-blue' : 'border-line bg-white text-muted'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <SoftCard className="flex items-center gap-2 text-small text-muted"><Circle className="h-4 w-4" />选择答案后提交判题</SoftCard>
            <SoftCard className="flex items-center gap-2 text-small text-muted"><Circle className="h-4 w-4" />错题会进入错题本</SoftCard>
            <SoftCard className="flex items-center gap-2 text-small text-muted"><Circle className="h-4 w-4" />报告会汇总练习结果</SoftCard>
          </div>
          <ProtoButton href="/generate" className="mt-4 w-full">生成补弱资源</ProtoButton>
        </ProtoCard>
      </div>
    </div>
  )
}

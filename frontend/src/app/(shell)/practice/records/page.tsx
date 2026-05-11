'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHead, ProtoButton, ProtoCard, SoftCard, Pill } from '@/components/proto'

interface QuizRecord {
  quiz_id: string
  answer: string | string[]
  correct: boolean
  correct_answer: string | string[]
  knowledge_point_id: string
  knowledge_point_name: string
  judge_mode: string
  question: {
    id: string
    type: string
    content: string
    options?: string[]
    explanation: string
    knowledge_point_id: string
    knowledge_point_name: string
  }
  at: string
}

export default function PracticeRecordsPage() {
  const [records, setRecords] = useState<QuizRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all')

  useEffect(() => {
    loadRecords()
  }, [])

  async function loadRecords() {
    setLoading(true)
    setError('')
    try {
      // 从后端获取所有答题记录
      const allRecords = await api.getQuizRecords()
      setRecords(allRecords)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '加载记录失败')
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(r => {
    if (filter === 'correct') return r.correct
    if (filter === 'wrong') return !r.correct
    return true
  })

  const stats = {
    total: records.length,
    correct: records.filter(r => r.correct).length,
    wrong: records.filter(r => !r.correct).length,
    accuracy: records.length > 0 ? Math.round((records.filter(r => r.correct).length / records.length) * 100) : 0,
  }

  return (
    <div>
      <PageHead
        eyebrow="练习评测 / 答题记录"
        title="答题记录"
        description="查看你的所有答题记录和统计数据"
        actions={<ProtoButton href="/practice" variant="secondary"><ChevronLeft className="h-4 w-4" />返回练习</ProtoButton>}
        chips={[
          { value: `${stats.total} 题`, label: '总计' },
          { value: `${stats.correct} 题`, label: '正确' },
          { value: `${stats.accuracy}%`, label: '正确率' },
        ]}
      />

      {error && <div className="mb-4 rounded-[12px] bg-red-light p-4 text-small text-red">{error}</div>}

      <div className="grid grid-cols-[1fr_280px] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          {loading ? (
            <div className="py-20 text-center text-muted">加载中...</div>
          ) : records.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-small text-muted">暂无答题记录</p>
              <ProtoButton href="/practice" className="mt-4">去练习</ProtoButton>
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`rounded-[8px] px-3 py-2 text-small font-bold transition-colors ${
                    filter === 'all'
                      ? 'bg-blue text-white'
                      : 'bg-[#f0f0f0] text-muted hover:bg-[#e0e0e0]'
                  }`}
                >
                  全部 ({stats.total})
                </button>
                <button
                  onClick={() => setFilter('correct')}
                  className={`rounded-[8px] px-3 py-2 text-small font-bold transition-colors ${
                    filter === 'correct'
                      ? 'bg-green text-white'
                      : 'bg-[#f0f0f0] text-muted hover:bg-[#e0e0e0]'
                  }`}
                >
                  正确 ({stats.correct})
                </button>
                <button
                  onClick={() => setFilter('wrong')}
                  className={`rounded-[8px] px-3 py-2 text-small font-bold transition-colors ${
                    filter === 'wrong'
                      ? 'bg-red text-white'
                      : 'bg-[#f0f0f0] text-muted hover:bg-[#e0e0e0]'
                  }`}
                >
                  错误 ({stats.wrong})
                </button>
              </div>

              <div className="space-y-3">
                {filteredRecords.map((record, idx) => (
                  <SoftCard key={idx} className="bg-white p-4">
                    <div className="flex items-start gap-3">
                      {record.correct ? (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green mt-1" />
                      ) : (
                        <XCircle className="h-5 w-5 flex-shrink-0 text-red mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-small font-bold text-ink">{record.question.content}</h3>
                          <Pill tone={record.correct ? 'green' : 'red'}>
                            {record.correct ? '正确' : '错误'}
                          </Pill>
                        </div>
                        
                        <div className="mt-2 space-y-1 text-micro text-muted">
                          <p><b>你的答案：</b> {Array.isArray(record.answer) ? record.answer.join(', ') : record.answer}</p>
                          <p><b>正确答案：</b> {Array.isArray(record.correct_answer) ? record.correct_answer.join(', ') : record.correct_answer}</p>
                          <p><b>知识点：</b> {record.question.knowledge_point_name}</p>
                          <p><b>判题方式：</b> {record.judge_mode}</p>
                          <p><b>时间：</b> {new Date(record.at).toLocaleString()}</p>
                        </div>

                        {record.question.explanation && (
                          <div className="mt-3 rounded-[8px] bg-[#f9fafb] p-3">
                            <p className="text-micro font-bold text-ink">解析：</p>
                            <p className="mt-1 text-micro text-muted">{record.question.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </>
          )}
        </ProtoCard>

        <aside className="grid gap-3">
          <ProtoCard>
            <h2 className="text-h2 font-bold text-ink">统计数据</h2>
            
            <div className="mt-4 space-y-2">
              <SoftCard className="flex items-center justify-between bg-white">
                <span>
                  <b className="text-small text-ink">总答题数</b>
                  <span className="block text-micro text-muted">所有题目</span>
                </span>
                <Pill tone="blue">{stats.total}</Pill>
              </SoftCard>
              
              <SoftCard className="flex items-center justify-between bg-white">
                <span>
                  <b className="text-small text-ink">正确数</b>
                  <span className="block text-micro text-muted">答对的题目</span>
                </span>
                <Pill tone="green">{stats.correct}</Pill>
              </SoftCard>
              
              <SoftCard className="flex items-center justify-between bg-white">
                <span>
                  <b className="text-small text-ink">错误数</b>
                  <span className="block text-micro text-muted">答错的题目</span>
                </span>
                <Pill tone="red">{stats.wrong}</Pill>
              </SoftCard>
              
              <SoftCard className="flex items-center justify-between bg-white">
                <span>
                  <b className="text-small text-ink">正确率</b>
                  <span className="block text-micro text-muted">达标线 80%</span>
                </span>
                <Pill tone={stats.accuracy >= 80 ? 'green' : 'orange'}>{stats.accuracy}%</Pill>
              </SoftCard>
            </div>

            <ProtoButton href="/practice" className="mt-4 w-full">继续练习</ProtoButton>
          </ProtoCard>
        </aside>
      </div>
    </div>
  )
}

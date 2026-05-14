'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Zap, Check, X, CheckSquare, ListChecks } from 'lucide-react'
import { api, QuizQuestion } from '@/lib/api'
import { PageHead, Pill, ProtoButton, ProtoCard, SoftCard } from '@/components/proto'
import { TypewriterLoader } from '@/components/ui/TypewriterLoader'

interface ExtendedQuizQuestion extends QuizQuestion {
  title?: string
  question?: string
  codeSnippet?: string
  knowledge_point_id?: string
  knowledge_point_name?: string
}

interface AnswerRecord {
  quizId: string
  answer: string | string[]
  correct: boolean
  correctAnswer: string | string[]
  explanation: string
  timestamp: string
}

export default function PracticePage() {
  const [questions, setQuestions] = useState<ExtendedQuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [count, setCount] = useState('4')
  const [topic, setTopic] = useState('函数返回值')
  const [generating, setGenerating] = useState(false)
  const [autoMode, setAutoMode] = useState(true)
  const [progressPage, setProgressPage] = useState(0)
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]) // 答题记录

  // 初始加载题目 - 自动生成8道题
  useEffect(() => {
    void initializeQuestions()
  }, [])

  async function initializeQuestions() {
    setLoading(true)
    setError('')
    try {
      // 添加1-2秒的延迟，让用户看到加载动画
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
      
      const data = await api.getQuizQuestions('函数返回值', 4)
      if (data && data.length > 0) {
        const enriched = data.map((q: any) => ({
          ...q,
          title: q.content || q.title || '题目',
          question: q.content || q.question || '',
        }))
        setQuestions(enriched)
        setCurrentIndex(0)
        setSubmitted(false)
        setSelectedAnswer(null)
        setCount('4')
        setTopic('函数返回值')
      } else {
        setError('未获取到题目数据，请稍后重试')
        setQuestions([])
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '初始化题目失败')
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  async function generateQuestions() {
    if (!topic.trim()) {
      setError('请输入题目主题')
      return
    }

    const countNum = parseInt(count)
    if (isNaN(countNum) || countNum < 1 || countNum > 50) {
      setError('题目数量必须在 1-50 之间')
      return
    }

    setGenerating(true)
    setError('')
    try {
      // 添加1-2秒的延迟，让用户看到加载动画
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
      
      const data = await api.getQuizQuestions(topic, countNum)
      if (data && data.length > 0) {
        const enriched = data.map((q: any) => ({
          ...q,
          title: q.content || q.title || '题目',
          question: q.content || q.question || '',
        }))
        // 追加新题目而不是替换
        setQuestions(prev => [...prev, ...enriched])
        setError('')
      } else {
        setError('未获取到题目数据，请检查题目主题')
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '生成题目失败')
    } finally {
      setGenerating(false)
    }
  }

  async function submitAnswer() {
    if (!selectedAnswer || !currentQuestion) return
    
    setLoading(true)
    try {
      const result = await api.submitQuizAnswer(currentQuestion.id, selectedAnswer)
      setSubmitted(true)
      
      // 保存答题记录
      const record: AnswerRecord = {
        quizId: currentQuestion.id,
        answer: selectedAnswer,
        correct: result.correct,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
        timestamp: new Date().toISOString(),
      }
      setAnswerRecords([...answerRecords, record])
      
      console.log('Answer submitted:', result)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '提交失败')
    } finally {
      setLoading(false)
    }
  }

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSubmitted(false)
      setSelectedAnswer(null)
      // 更新进度页码
      const newPage = Math.floor((currentIndex + 1) / 8)
      setProgressPage(newPage)
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSubmitted(false)
      setSelectedAnswer(null)
      // 更新进度页码
      const newPage = Math.floor((currentIndex - 1) / 8)
      setProgressPage(newPage)
    }
  }

  function goToQuestion(idx: number) {
    setCurrentIndex(idx)
    
    // 检查该题是否已答过
    const record = answerRecords.find(r => r.quizId === questions[idx]?.id)
    if (record) {
      // 恢复该题的答案和状态
      // 对于多选题，保持数组形式；对于单选题和填空题，保持字符串形式
      setSelectedAnswer(record.answer)
      setSubmitted(true)
    } else {
      // 未答过的题目，清空状态
      setSubmitted(false)
      setSelectedAnswer(null)
    }
    
    const newPage = Math.floor(idx / 8)
    setProgressPage(newPage)
  }

  // 检查某道题是否已答过
  function isQuestionAnswered(idx: number): boolean {
    return answerRecords.some(r => r.quizId === questions[idx]?.id)
  }

  // 获取某道题的答题结果
  function getQuestionResult(idx: number): 'correct' | 'wrong' | null {
    const record = answerRecords.find(r => r.quizId === questions[idx]?.id)
    if (!record) return null
    return record.correct ? 'correct' : 'wrong'
  }

  const currentQuestion = questions[currentIndex]
  
  // 计算正确率 - 统计已提交的题目中有多少是正确的
  const totalSubmitted = answerRecords.length
  const correctCount = answerRecords.filter(r => r.correct).length
  const accuracy = totalSubmitted > 0 ? Math.round((correctCount / totalSubmitted) * 100) : 0
  const countNum = parseInt(count) || 4
  
  // 计算进度分页
  const questionsPerPage = 8
  const totalPages = Math.ceil(questions.length / questionsPerPage)
  const startIdx = progressPage * questionsPerPage
  const endIdx = Math.min(startIdx + questionsPerPage, questions.length)
  const currentPageQuestions = questions.slice(startIdx, endIdx)

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-6 border-b border-line pb-4">
        <div className="min-w-0">
          <div className="mb-2 text-small font-extrabold text-soft">练习评测 / 判题、解析、错题</div>
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-h1 font-bold leading-tight tracking-normal text-ink">练习评测</h1>
            <ProtoButton href="/practice/mistakes" variant="secondary">错题本</ProtoButton>
            <ProtoButton href="/practice/favorites" variant="secondary">收藏题目</ProtoButton>
          </div>
          <p className="mt-2 max-w-[760px] text-body leading-7 text-muted">完成针对性练习后，系统会回写画像、错题本和学习路径。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {[
            { value: `${questions.length} 题`, label: '本次练习' },
            { value: '80%', label: '达标线' },
            { value: `${accuracy}%`, label: '当前正确率' },
          ].map((chip) => (
            <div key={chip.label} className="min-w-[108px] rounded-[10px] border border-line bg-white px-3 py-2">
              <b className="block text-[16px] leading-tight text-ink">{chip.value}</b>
              <span className="mt-0.5 block text-micro text-muted">{chip.label}</span>
            </div>
          ))}
        </div>
      </header>

      {error && <div className="mb-4 rounded-[12px] bg-red-light p-4 text-small text-red">{error}</div>}

      <div className="grid grid-cols-[1fr_320px] gap-4 max-[980px]:grid-cols-1">
        <ProtoCard>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <TypewriterLoader text="加载题目中..." />
            </div>
          ) : questions.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-small text-muted">暂无题目，请先生成练习题</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pill tone="blue">个性化练习 · {topic}</Pill>
                  <div className="mt-3 flex items-center gap-2">
                    <h2 className="text-h2 font-bold text-ink">第 {currentIndex + 1} 题：{currentQuestion?.title || '题目'}</h2>
                    <Pill tone={
                      currentQuestion?.type === 'single' ? 'blue' :
                      currentQuestion?.type === 'multiple' ? 'orange' :
                      'green'
                    }>
                      {currentQuestion?.type === 'single' ? '单选题' :
                       currentQuestion?.type === 'multiple' ? '多选题' :
                       '填空题'}
                    </Pill>
                  </div>
                </div>
                <span className="text-micro text-muted">当前题组：{questions.length} 题 · 预计 {Math.ceil(questions.length * 1.5)} 分钟</span>
              </div>

              {currentQuestion && (
                <>
                  <div className="mt-5 rounded-[12px] border border-line bg-[#f9fafb] p-4">
                    <b className="text-small text-ink">{currentQuestion.question || currentQuestion.content}</b>
                    {currentQuestion.codeSnippet && (
                      <pre className="mt-3 overflow-auto rounded-[10px] bg-[#0f172a] p-4 text-small leading-6 text-white">
                        {currentQuestion.codeSnippet}
                      </pre>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {currentQuestion.type === 'fill_blank' ? (
                      // 填空题：显示文本输入框
                      <div className="space-y-3">
                        <div className="rounded-[12px] border-2 border-line bg-white p-4">
                          <p className="text-small text-muted mb-3">请输入答案：</p>
                          <input
                            type="text"
                            value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                            onChange={(e) => !submitted && setSelectedAnswer(e.target.value)}
                            disabled={submitted}
                            placeholder="输入你的答案..."
                            className="w-full rounded-[8px] border-2 border-line px-3 py-2 text-small outline-none focus:border-blue disabled:bg-gray-100"
                          />
                        </div>
                        {currentQuestion.options && currentQuestion.options.length > 0 && (
                          <div className="mt-4">
                            <p className="text-micro text-muted mb-2">参考答案：</p>
                            <div className="space-y-2">
                              {currentQuestion.options.map((option, idx) => {
                                const isSelected = selectedAnswer === option
                                const isCorrect = option === currentQuestion.correctAnswer
                                
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => !submitted && setSelectedAnswer(option)}
                                    disabled={submitted}
                                    className={`w-full rounded-[10px] border-2 px-3 py-2 text-left text-small font-medium transition-colors flex items-center justify-between ${
                                      submitted
                                        ? isCorrect
                                          ? 'border-green bg-green-light text-green'
                                          : isSelected
                                          ? 'border-red bg-red-light text-red'
                                          : 'border-line bg-white text-ink'
                                        : isSelected
                                        ? 'border-blue bg-blue-light text-blue'
                                        : 'border-line bg-white text-ink hover:border-line'
                                    }`}
                                  >
                                    <span>{option}</span>
                                    {submitted && isCorrect && <Check className="h-4 w-4" />}
                                    {submitted && isSelected && !isCorrect && <X className="h-4 w-4" />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : currentQuestion.type === 'multiple' ? (
                      // 多选题：显示方形复选框
                      <div className="grid grid-cols-2 gap-3">
                        {currentQuestion.options && currentQuestion.options.length > 0 ? (
                          currentQuestion.options.map((option, idx) => {
                            const isSelected = Array.isArray(selectedAnswer) && selectedAnswer.includes(option)
                            const isCorrect = Array.isArray(currentQuestion.correctAnswer) && currentQuestion.correctAnswer.includes(option)
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (submitted) return
                                  const current = Array.isArray(selectedAnswer) ? selectedAnswer : []
                                  if (isSelected) {
                                    setSelectedAnswer(current.filter(a => a !== option))
                                  } else {
                                    setSelectedAnswer([...current, option])
                                  }
                                }}
                                disabled={submitted}
                                className={`relative rounded-[10px] border-2 p-3 text-left text-small font-bold transition-colors flex items-start gap-2 ${
                                  submitted
                                    ? isCorrect
                                      ? 'border-green bg-green-light'
                                      : isSelected
                                      ? 'border-red bg-red-light'
                                      : 'border-line bg-white'
                                    : isSelected
                                    ? 'border-blue bg-blue-light'
                                    : 'border-line bg-white hover:border-line'
                                }`}
                              >
                                {/* 复选框 */}
                                <div className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded-[4px] border-2 flex items-center justify-center ${
                                  submitted
                                    ? isCorrect
                                      ? 'border-green bg-green'
                                      : isSelected
                                      ? 'border-red bg-red'
                                      : 'border-line bg-white'
                                    : isSelected
                                    ? 'border-blue bg-blue'
                                    : 'border-line bg-white'
                                }`}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className={
                                  submitted
                                    ? isCorrect
                                      ? 'text-green'
                                      : isSelected
                                      ? 'text-red'
                                      : 'text-ink'
                                    : isSelected
                                    ? 'text-blue'
                                    : 'text-ink'
                                }>
                                  {option}
                                </span>
                                {submitted && isCorrect && <Check className="h-4 w-4 ml-auto text-green" />}
                                {submitted && isSelected && !isCorrect && <X className="h-4 w-4 ml-auto text-red" />}
                              </button>
                            )
                          })
                        ) : (
                          <div className="text-small text-muted">暂无选项</div>
                        )}
                      </div>
                    ) : (
                      // 单选题：显示圆形单选按钮（原型风格）
                      <div className="space-y-2">
                        {currentQuestion.options && currentQuestion.options.length > 0 ? (
                          currentQuestion.options.map((option, idx) => {
                            const isSelected = selectedAnswer === option
                            const isCorrect = option === currentQuestion.correctAnswer
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => !submitted && setSelectedAnswer(option)}
                                disabled={submitted}
                                className={`w-full rounded-[12px] border-2 px-4 py-3 text-left text-small font-bold transition-colors flex items-center gap-3 ${
                                  submitted
                                    ? isCorrect
                                      ? 'border-green bg-green-light'
                                      : isSelected
                                      ? 'border-red bg-red-light'
                                      : 'border-line bg-white'
                                    : isSelected
                                    ? 'border-blue bg-blue-light'
                                    : 'border-line bg-white hover:border-line'
                                }`}
                              >
                                {/* 单选圆形按钮 */}
                                <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                                  submitted
                                    ? isCorrect
                                      ? 'border-green bg-green'
                                      : isSelected
                                      ? 'border-red bg-red'
                                      : 'border-line bg-white'
                                    : isSelected
                                    ? 'border-blue bg-blue'
                                    : 'border-line bg-white'
                                }`}>
                                  {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <span className={
                                  submitted
                                    ? isCorrect
                                      ? 'text-green'
                                      : isSelected
                                      ? 'text-red'
                                      : 'text-ink'
                                    : isSelected
                                    ? 'text-blue'
                                    : 'text-ink'
                                }>
                                  {option}
                                </span>
                                {submitted && isCorrect && <Check className="h-4 w-4 ml-auto text-green" />}
                                {submitted && isSelected && !isCorrect && <X className="h-4 w-4 ml-auto text-red" />}
                              </button>
                            )
                          })
                        ) : (
                          <div className="text-small text-muted">暂无选项</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <ProtoButton onClick={submitAnswer} disabled={!selectedAnswer || submitted || loading}>
                      {submitted ? '已提交' : '提交判题'}
                    </ProtoButton>
                    <div className="flex gap-2 ml-auto">
                      <ProtoButton variant="tertiary" onClick={prevQuestion} disabled={currentIndex === 0}>
                        <ChevronLeft className="h-4 w-4" />
                      </ProtoButton>
                      <ProtoButton variant="tertiary" onClick={nextQuestion} disabled={currentIndex === questions.length - 1}>
                        <ChevronRight className="h-4 w-4" />
                      </ProtoButton>
                    </div>
                  </div>

                  {submitted && (
                    <SoftCard className="mt-5 bg-white">
                      {(() => {
                        const isMultiple = currentQuestion.type === 'multiple'
                        const isCorrect = isMultiple
                          ? Array.isArray(selectedAnswer) && Array.isArray(currentQuestion.correctAnswer) &&
                            selectedAnswer.length === currentQuestion.correctAnswer.length &&
                            selectedAnswer.every(a => currentQuestion.correctAnswer.includes(a))
                          : selectedAnswer === currentQuestion.correctAnswer
                        
                        return (
                          <>
                            <Pill tone={isCorrect ? 'green' : 'red'}>
                              判题结果：{isCorrect ? '正确' : '错误'}
                            </Pill>
                            <h2 className="mt-3 text-h2 font-bold text-ink">
                              正确答案是 {Array.isArray(currentQuestion.correctAnswer) ? currentQuestion.correctAnswer.join('、') : currentQuestion.correctAnswer}
                            </h2>
                          </>
                        )
                      })()}
                      <p className="mt-3 text-small leading-6 text-muted">{currentQuestion.explanation || '暂无解析'}</p>
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        <ProtoButton href="/generate">一键生成补弱资源</ProtoButton>
                        <ProtoButton href="/resources" variant="secondary">查看推荐资源</ProtoButton>
                      </div>
                    </SoftCard>
                  )}
                </>
              )}
            </>
          )}
        </ProtoCard>

        <aside className="grid gap-3">
          <ProtoCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                  <CheckSquare className="h-4 w-4" />
                </div>
                <h2 className="text-h2 font-bold text-ink">生成练习</h2>
              </div>
              <Pill tone="blue">个性化</Pill>
            </div>
            
            {/* 切换按钮 */}
            <div className="mt-4 flex gap-2 rounded-[10px] border border-line p-1 bg-[#f9fafb]">
              <button
                onClick={() => setAutoMode(true)}
                className={`flex-1 h-8 rounded-[8px] text-micro font-bold transition-colors ${
                  autoMode
                    ? 'bg-white text-blue border border-blue'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Zap className="h-3 w-3 inline mr-1" />
                自动生成
              </button>
              <button
                onClick={() => setAutoMode(false)}
                className={`flex-1 h-8 rounded-[8px] text-micro font-bold transition-colors ${
                  !autoMode
                    ? 'bg-white text-blue border border-blue'
                    : 'text-muted hover:text-ink'
                }`}
              >
                手动输入
              </button>
            </div>

            {autoMode ? (
              <>
                <label className="mt-4 block text-micro text-muted">选择主题</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-2 h-10 w-full rounded-[10px] border border-line bg-white px-3 text-small outline-none focus:border-blue"
                >
                  <option value="函数返回值">函数返回值</option>
                  <option value="循环语句">循环语句</option>
                  <option value="条件判断">条件判断</option>
                  <option value="列表操作">列表操作</option>
                  <option value="字典操作">字典操作</option>
                  <option value="字符串处理">字符串处理</option>
                </select>
              </>
            ) : (
              <>
                <label className="mt-4 block text-micro text-muted">输入主题</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：函数返回值"
                  className="mt-2 h-10 w-full rounded-[10px] border border-line px-3 text-small outline-none focus:border-blue"
                />
              </>
            )}

            <label className="mt-3 block text-micro text-muted">题目数量（1-50）</label>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setCount('')
                  } else {
                    const num = parseInt(val)
                    if (!isNaN(num)) {
                      setCount(Math.min(50, Math.max(1, num)).toString())
                    }
                  }
                }}
                onBlur={() => {
                  if (count === '' || isNaN(parseInt(count))) {
                    setCount('8')
                  }
                }}
                placeholder="输入题目数量"
                className="h-10 flex-1 rounded-[10px] border border-line px-3 text-small outline-none focus:border-blue"
              />
              <ProtoButton
                variant="tertiary"
                onClick={() => setCount(Math.max(1, countNum - 1).toString())}
              >
                -
              </ProtoButton>
              <ProtoButton
                variant="tertiary"
                onClick={() => setCount(Math.min(50, countNum + 1).toString())}
              >
                +
              </ProtoButton>
            </div>

            <ProtoButton className="mt-3 w-full" onClick={generateQuestions} disabled={generating || !topic.trim()}>
              {generating ? <TypewriterLoader size="sm" /> : '生成练习题'}
            </ProtoButton>
          </ProtoCard>

          <ProtoCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#fff7ed] text-[#d97706]">
                  <ListChecks className="h-4 w-4" />
                </div>
                <h2 className="text-h2 font-bold text-ink">答题进度</h2>
              </div>
              <Pill tone="blue">{questions.length > 0 ? `${currentIndex + 1} / ${questions.length}` : '0 / 0'}</Pill>
            </div>
            {questions.length > 0 && (
              <>
                {/* 题目按钮网格 - 8个一页 */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {currentPageQuestions.map((_, idx) => {
                    const actualIdx = startIdx + idx
                    const isAnswered = isQuestionAnswered(actualIdx)
                    const result = getQuestionResult(actualIdx)
                    const isCurrent = actualIdx === currentIndex
                    
                    return (
                      <button
                        key={actualIdx}
                        onClick={() => goToQuestion(actualIdx)}
                        title={
                          result === 'correct' ? '已答对' :
                          result === 'wrong' ? '已答错' :
                          isCurrent ? '当前题目' :
                          '未答题'
                        }
                        className={`h-10 rounded-[10px] border text-small font-bold transition-colors flex items-center justify-center gap-1 ${
                          result === 'correct'
                            ? 'border-green bg-green-light text-green'
                            : result === 'wrong'
                            ? 'border-red bg-red-light text-red'
                            : isCurrent
                            ? 'border-blue bg-blue-light text-blue'
                            : 'border-line bg-white text-muted hover:border-blue'
                        }`}
                      >
                        <span>{actualIdx + 1}</span>
                        {result === 'correct' && <Check className="h-3 w-3" />}
                        {result === 'wrong' && <X className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>

                {/* 分页导航 */}
                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between">
                    <ProtoButton
                      variant="tertiary"
                      onClick={() => setProgressPage(Math.max(0, progressPage - 1))}
                      disabled={progressPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </ProtoButton>
                    <span className="text-micro text-muted">
                      {progressPage + 1} / {totalPages}
                    </span>
                    <ProtoButton
                      variant="tertiary"
                      onClick={() => setProgressPage(Math.min(totalPages - 1, progressPage + 1))}
                      disabled={progressPage === totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </ProtoButton>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <SoftCard className="flex items-center justify-between bg-white">
                    <span>
                      <b className="text-small text-ink">完成</b>
                      <span className="block text-micro text-muted">{totalSubmitted} 题</span>
                    </span>
                    <Pill tone="green">{totalSubmitted} 题</Pill>
                  </SoftCard>
                  <SoftCard className="flex items-center justify-between bg-white">
                    <span>
                      <b className="text-small text-ink">正确率</b>
                      <span className="block text-micro text-muted">达标线 80%</span>
                    </span>
                    <Pill tone={accuracy >= 80 ? 'green' : 'orange'}>{accuracy}%</Pill>
                  </SoftCard>
                </div>
              </>
            )}
          </ProtoCard>
        </aside>
      </div>
    </div>
  )
}

import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AppIcon from '../../components/AppIcon'
import AppTabBar from '../../components/AppTabBar'
import { getQuiz, setFavorite, submitQuiz } from '../../services/quizApi'
import type { QuizQuestion, SubmitQuizResult } from '../../types/quiz'
import { buildAskAiPrompt, clamp, stringifyAnswer } from '../../utils/format'
import { getQuizDraft, setAskAiContext, setQuizDraft } from '../../utils/storage'
import './index.scss'

function getTypeLabel(type?: string) {
  if (type === 'multiple') return '多选题'
  if (type === 'fill_blank') return '填空题'
  return '单选题'
}

function hasAnswer(answer?: string | string[]) {
  if (Array.isArray(answer)) return answer.length > 0
  return Boolean(answer && answer.trim())
}

const topicPresets = [
  'Python 基础语法',
  '函数与 return',
  '闭包与 nonlocal',
  '列表和字典',
  '错题知识点复盘',
  '面试常考基础题'
]

const practicePrompts = [
  '用 4 道题快速检查今天的掌握情况',
  '围绕薄弱知识点生成一组针对练习',
  '先做基础题，再让 AI 讲解错因'
]

export default function QuizPage() {
  const initialDraft = useMemo(() => getQuizDraft(), [])
  const [chapter, setChapter] = useState('Python 基础')
  const [count, setCount] = useState(4)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [results, setResults] = useState<Record<string, SubmitQuizResult>>({})
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const current = questions[currentIndex]
  const currentAnswer = current ? answers[current.id] : undefined
  const currentResult = current ? results[current.id] : undefined
  const canSubmit = Boolean(current && hasAnswer(currentAnswer) && !currentResult && !submitting)
  const completedCount = Object.keys(results).length
  const hasPractice = questions.length > 0

  const optionList = useMemo(() => current?.options || [], [current])

  useEffect(() => {
    if (!initialDraft) return
    const safeIndex = initialDraft.questions.length
      ? clamp(initialDraft.currentIndex, 0, initialDraft.questions.length - 1)
      : 0
    setChapter(initialDraft.chapter)
    setCount(initialDraft.count)
    setQuestions(initialDraft.questions)
    setCurrentIndex(safeIndex)
    setAnswers(initialDraft.answers)
    setResults(initialDraft.results)
    setFavorites(initialDraft.favorites)
  }, [initialDraft])

  useEffect(() => {
    setQuizDraft({
      chapter,
      count,
      questions,
      currentIndex,
      answers,
      results,
      favorites
    })
  }, [answers, chapter, count, currentIndex, favorites, questions, results])

  const handleGenerate = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const nextQuestions = await getQuiz(chapter.trim() || 'Python 基础', count)
      if (!nextQuestions.length) {
        setError('暂时没有生成题目，请换个主题再试。')
        return
      }
      setQuestions(nextQuestions)
      setCurrentIndex(0)
      setAnswers({})
      setResults({})
      setFavorites({})
      Taro.showToast({ title: '题目已生成', icon: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '题目生成失败')
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handlePickTopic = (topic: string) => {
    setChapter(topic)
  }

  const updateAnswer = (value: string) => {
    if (!current || currentResult) return
    setAnswers((prev) => {
      if (current.type !== 'multiple') {
        return { ...prev, [current.id]: value }
      }

      const existing = Array.isArray(prev[current.id]) ? (prev[current.id] as string[]) : []
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      return { ...prev, [current.id]: next }
    })
  }

  const handleSubmit = async () => {
    if (!current || !canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitQuiz(current.id, currentAnswer as string | string[])
      setResults((prev) => ({ ...prev, [current.id]: result }))
      Taro.showToast({ title: result.correct ? '回答正确' : '已判题', icon: result.correct ? 'success' : 'none' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
      Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleFavorite = async () => {
    if (!current) return
    const nextFavorite = !favorites[current.id]
    setFavorites((prev) => ({ ...prev, [current.id]: nextFavorite }))
    try {
      await setFavorite(current.id, nextFavorite)
      Taro.showToast({ title: nextFavorite ? '已收藏' : '已取消', icon: 'none' })
    } catch {
      setFavorites((prev) => ({ ...prev, [current.id]: !nextFavorite }))
      Taro.showToast({ title: '收藏失败', icon: 'none' })
    }
  }

  const handleNext = () => {
    if (currentIndex >= questions.length - 1) {
      Taro.showToast({ title: '已经是最后一题', icon: 'none' })
      return
    }
    setCurrentIndex((value) => value + 1)
  }

  const handleAskAi = () => {
    if (!current) return
    setQuizDraft({
      chapter,
      count,
      questions,
      currentIndex,
      answers,
      results,
      favorites
    })
    const promptContext = {
      source: 'quiz_result' as const,
      quizId: current.id,
      question: current.content,
      questionType: current.type,
      userAnswer: currentAnswer,
      correctAnswer: currentResult?.correct_answer || current.correct_answer,
      explanation: currentResult?.explanation || current.explanation,
      knowledgePointName: current.knowledge_point_name || currentResult?.knowledge_point_name
    }
    setAskAiContext(promptContext)
    Taro.redirectTo({ url: '/pages/tutor/index' })
  }

  return (
    <View className='app-page quiz-page'>
      <AppHeader eyebrow='Practice' title='刷题'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.showToast({ title: '默认使用 AI 生成题目', icon: 'none' })}>
          <Text>AI</Text>
        </View>
      </AppHeader>

      {hasPractice ? (
        <View className='practice-strip'>
          <View className='practice-strip__main'>
            <Text className='practice-strip__title'>{chapter || '自定义练习'}</Text>
            <Text className='practice-strip__meta'>{count} 题 · 已完成 {completedCount} 题 · 第 {currentIndex + 1} 题</Text>
          </View>
          <View className='practice-strip__action' hoverClass='tap-active' onClick={handleGenerate}>
            <Text>{loading ? '生成中' : '换一组'}</Text>
          </View>
        </View>
      ) : (
        <View className='quiz-start'>
          <View className='start-hero'>
            <View className='start-icon'>
              <AppIcon name='quiz' />
            </View>
            <Text className='start-title'>开始一组针对练习</Text>
            <Text className='start-subtitle'>选一个主题，SparkLearn 会生成题目、判题、沉淀错题，并把讲不透的地方交给 AI 助学。</Text>
          </View>

          <View className='starter-card'>
            <View className='starter-card__head'>
              <View>
                <Text className='section-title'>练习主题</Text>
                <Text className='section-subtitle'>选择推荐主题，或直接输入你想练的内容。</Text>
              </View>
            </View>
            <Input
              className='topic-input topic-input--large'
              value={chapter}
              placeholder='输入主题'
              onInput={(event) => setChapter(event.detail.value)}
            />
            <View className='topic-grid'>
              {topicPresets.map((topic) => (
                <View
                  key={topic}
                  className={`topic-chip ${chapter === topic ? 'is-active' : ''}`}
                  hoverClass='tap-active'
                  onClick={() => handlePickTopic(topic)}
                >
                  <Text>{topic}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='starter-card starter-card--compact'>
            <View className='count-row'>
              <View>
                <Text className='section-title'>题目数量</Text>
                <Text className='section-subtitle'>建议先用 4 题快速校准。</Text>
              </View>
              <View className='stepper-body stepper-body--large'>
                <Text className='stepper-hit' onClick={() => setCount((value) => clamp(value - 1, 1, 20))}>-</Text>
                <Text className='stepper-value'>{count} 题</Text>
                <Text className='stepper-hit' onClick={() => setCount((value) => clamp(value + 1, 1, 20))}>+</Text>
              </View>
            </View>
            <View className='practice-hints'>
              {practicePrompts.map((item) => (
                <View key={item} className='practice-hint'>
                  <AppIcon name='sparkles' />
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
            <View className={`generate-button start-button ${loading ? 'is-disabled' : ''}`} hoverClass='tap-active' onClick={handleGenerate}>
              <Text>{loading ? '正在生成练习...' : '开始练习'}</Text>
            </View>
          </View>
        </View>
      )}

      {error ? (
        <View className='inline-error'>
          <Text>{error}</Text>
          <Text className='inline-error__action' onClick={handleGenerate}>重试</Text>
        </View>
      ) : null}

      {current ? (
        <View className='quiz-card'>
          <View className='quiz-card__top'>
            <View className='progress-block'>
              <Text className='progress-label'>第 {currentIndex + 1} / {questions.length} 题</Text>
              <View className='progress-track'>
                <View className='progress-fill' style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
              </View>
            </View>
            <View className='tag-row'>
              <Text className='tag tag--blue'>{getTypeLabel(current.type)}</Text>
              <Text className='tag tag--soft'>{current.knowledge_point_name || '通用能力'}</Text>
            </View>
          </View>
          <Text className='question-text'>{current.content}</Text>

          {current.type === 'fill_blank' ? (
            <Input
              className='fill-input'
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              disabled={Boolean(currentResult)}
              placeholder='输入答案'
              onInput={(event) => updateAnswer(event.detail.value)}
            />
          ) : (
            <View className='option-list'>
              {optionList.map((option, index) => {
                const selected = Array.isArray(currentAnswer) ? currentAnswer.includes(option) : currentAnswer === option
                return (
                  <View
                    key={option}
                    className={`option-item ${selected ? 'is-selected' : ''}`}
                    hoverClass='tap-active'
                    onClick={() => updateAnswer(option)}
                  >
                    <View className={`option-key ${current.type === 'multiple' ? 'option-key--multiple' : 'option-key--single'}`}>
                      {String.fromCharCode(65 + index)}
                    </View>
                    <Text className='option-value'>{option}</Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      ) : null}

      {currentResult ? (
        <View className={`result-card ${currentResult.correct ? '' : 'result-card--wrong'}`}>
          <View className='result-status'>
            <View className={`status-dot ${currentResult.correct ? 'status-dot--green' : 'status-dot--red'}`} />
            <Text>{currentResult.correct ? '回答正确' : '需要复盘'}</Text>
          </View>
          <Text className='result-text'>正确答案：{stringifyAnswer(currentResult.correct_answer)}</Text>
          <Text className='result-text'>{currentResult.explanation || '建议对照知识点重新梳理。'}</Text>
        </View>
      ) : null}

      {current ? (
        <View className='quiz-actionbar'>
          <View className='secondary-action' hoverClass='tap-active' onClick={handleFavorite}>
            <Text>{favorites[current.id] ? '已收藏' : '收藏'}</Text>
          </View>
          <View className={`primary-action ${currentResult || canSubmit ? '' : 'is-disabled'}`} hoverClass='tap-active' onClick={currentResult ? handleNext : handleSubmit}>
            <Text>{currentResult ? '下一题' : submitting ? '提交中...' : '提交答案'}</Text>
          </View>
          <View className='secondary-action secondary-action--blue' hoverClass='tap-active' onClick={handleAskAi}>
            <Text>问 AI</Text>
          </View>
        </View>
      ) : null}

      <AppTabBar current='quiz' />
    </View>
  )
}

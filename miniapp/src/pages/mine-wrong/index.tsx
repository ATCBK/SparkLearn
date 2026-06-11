import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import { deleteWrongQuiz, getWrongQuiz } from '../../services/quizApi'
import type { WrongQuizItem } from '../../types/quiz'
import { buildAskAiPrompt, stringifyAnswer } from '../../utils/format'
import { setAskAiContext } from '../../utils/storage'
import './index.scss'

export default function MineWrongPage() {
  const [items, setItems] = useState<WrongQuizItem[]>([])
  const [error, setError] = useState('')

  const loadData = async () => {
    setError('')
    try {
      const data = await getWrongQuiz()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '错题加载失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAskAi = (item: WrongQuizItem) => {
    const context = {
      source: 'wrong_detail' as const,
      quizId: item.quiz_id,
      question: item.question?.content || item.content || '题目内容暂不可用',
      questionType: item.question?.type,
      userAnswer: item.user_answer,
      correctAnswer: item.correct_answer,
      explanation: item.question?.explanation,
      knowledgePointName: item.question?.knowledge_point_name
    }
    setAskAiContext(context)
    Taro.redirectTo({ url: '/pages/tutor/index' })
  }

  const handleDelete = async (quizId: string) => {
    try {
      await deleteWrongQuiz(quizId)
      setItems((prev) => prev.filter((item) => item.quiz_id !== quizId))
      Taro.showToast({ title: '已移除', icon: 'none' })
    } catch {
      Taro.showToast({ title: '移除失败', icon: 'none' })
    }
  }

  return (
    <View className='app-page sub-page'>
      <AppHeader eyebrow='Review' title='错题本'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </AppHeader>

      {error ? <View className='inline-error'><Text>{error}</Text><Text className='inline-error__action' onClick={loadData}>重试</Text></View> : null}

      <View className='sub-list'>
        {items.length ? items.map((item) => (
          <View key={item.quiz_id} className='sub-card'>
            <View className='sub-card__top'>
              <Text className='sub-title'>{item.question?.content || item.content || '题目内容暂不可用'}</Text>
              <Text className='tag tag--danger'>{item.count || 1} 次</Text>
            </View>
            <Text className='sub-meta'>我的答案：{stringifyAnswer(item.user_answer)}</Text>
            <Text className='sub-meta'>正确答案：{stringifyAnswer(item.correct_answer)}</Text>
            <View className='sub-actions'>
              <View className='sub-action' hoverClass='tap-active' onClick={() => handleAskAi(item)}>
                <Text>问 AI</Text>
              </View>
              <View className='sub-action sub-action--danger' hoverClass='tap-active' onClick={() => handleDelete(item.quiz_id)}>
                <Text>移除错题</Text>
              </View>
            </View>
          </View>
        )) : <View className='empty-card'><Text>暂无错题</Text><Text className='section-subtitle'>保持这个状态，很舒服。</Text></View>}
      </View>
    </View>
  )
}

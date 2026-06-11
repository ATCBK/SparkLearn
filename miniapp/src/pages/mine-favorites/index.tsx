import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import { getFavorites, setFavorite } from '../../services/quizApi'
import type { FavoriteQuizItem } from '../../types/quiz'
import { setAskAiContext } from '../../utils/storage'
import './index.scss'

export default function MineFavoritesPage() {
  const [items, setItems] = useState<FavoriteQuizItem[]>([])
  const [error, setError] = useState('')

  const loadData = async () => {
    setError('')
    try {
      const data = await getFavorites()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '收藏题加载失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAskAi = (item: FavoriteQuizItem) => {
    setAskAiContext({
      source: 'favorite_detail',
      quizId: item.quiz_id,
      question: item.question?.content || '题目内容暂不可用',
      questionType: item.question?.type,
      correctAnswer: item.question?.correct_answer,
      explanation: item.question?.explanation,
      knowledgePointName: item.question?.knowledge_point_name
    })
    Taro.redirectTo({ url: '/pages/tutor/index' })
  }

  const handleCancel = async (quizId: string) => {
    try {
      await setFavorite(quizId, false)
      setItems((prev) => prev.filter((item) => item.quiz_id !== quizId))
      Taro.showToast({ title: '已取消收藏', icon: 'none' })
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  return (
    <View className='app-page sub-page'>
      <AppHeader eyebrow='Review' title='收藏题'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </AppHeader>

      {error ? <View className='inline-error'><Text>{error}</Text><Text className='inline-error__action' onClick={loadData}>重试</Text></View> : null}

      <View className='sub-list'>
        {items.length ? items.map((item) => (
          <View key={item.quiz_id} className='sub-card'>
            <View className='sub-card__top'>
              <Text className='sub-title'>{item.question?.content || '题目内容暂不可用'}</Text>
              <Text className='tag tag--soft'>{item.question?.knowledge_point_name || '收藏'}</Text>
            </View>
            <Text className='sub-meta'>收藏时间：{item.created_at || '未知'}</Text>
            <View className='sub-actions'>
              <View className='sub-action' hoverClass='tap-active' onClick={() => handleAskAi(item)}>
                <Text>问 AI</Text>
              </View>
              <View className='sub-action sub-action--danger' hoverClass='tap-active' onClick={() => handleCancel(item.quiz_id)}>
                <Text>取消收藏</Text>
              </View>
            </View>
          </View>
        )) : <View className='empty-card'><Text>暂无收藏题</Text><Text className='section-subtitle'>刷题时点收藏，会同步到这里。</Text></View>}
      </View>
    </View>
  )
}

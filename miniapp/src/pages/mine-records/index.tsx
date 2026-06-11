import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import { deleteQuizRecord, getQuizRecords } from '../../services/quizApi'
import type { QuizRecord } from '../../types/quiz'
import { stringifyAnswer } from '../../utils/format'
import './index.scss'

export default function MineRecordsPage() {
  const [records, setRecords] = useState<QuizRecord[]>([])
  const [error, setError] = useState('')

  const loadData = async () => {
    setError('')
    try {
      const data = await getQuizRecords()
      setRecords(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '答题记录加载失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (quizId: string) => {
    try {
      await deleteQuizRecord(quizId)
      setRecords((prev) => prev.filter((item) => item.quiz_id !== quizId))
      Taro.showToast({ title: '已删除', icon: 'none' })
    } catch {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  return (
    <View className='app-page sub-page'>
      <AppHeader eyebrow='Review' title='答题记录'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </AppHeader>

      {error ? <View className='inline-error'><Text>{error}</Text><Text className='inline-error__action' onClick={loadData}>重试</Text></View> : null}

      <View className='sub-list'>
        {records.length ? records.map((item) => (
          <View key={`${item.quiz_id}-${item.at || ''}`} className='sub-card'>
            <View className='sub-card__top'>
              <Text className='sub-title'>{item.question?.content || '题目内容暂不可用'}</Text>
              <Text className={`tag ${item.correct ? 'tag--success' : 'tag--danger'}`}>{item.correct ? '正确' : '错题'}</Text>
            </View>
            <Text className='sub-meta'>我的答案：{stringifyAnswer(item.answer)}</Text>
            <Text className='sub-meta'>知识点：{item.question?.knowledge_point_name || item.knowledge_point_name || '未标注'}</Text>
            <View className='sub-actions'>
              <View className='sub-action sub-action--danger' hoverClass='tap-active' onClick={() => handleDelete(item.quiz_id)}>
                <Text>删除记录</Text>
              </View>
            </View>
          </View>
        )) : <View className='empty-card'><Text>暂无答题记录</Text><Text className='section-subtitle'>完成刷题后会出现在这里。</Text></View>}
      </View>
    </View>
  )
}

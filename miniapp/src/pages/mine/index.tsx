import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AppTabBar from '../../components/AppTabBar'
import { getFavorites, getQuizStats, getWrongQuiz } from '../../services/quizApi'
import { getDashboardStats, getMastery, getProfile } from '../../services/profileApi'
import type { QuizStats } from '../../types/quiz'
import type { DashboardStats, LearningProfile, MasteryItem } from '../../types/profile'
import { percentText } from '../../utils/format'
import './index.scss'

const reviewItems = [
  { label: '答题记录', path: '/pages/mine-records/index', icon: '' },
  { label: '错题本', path: '/pages/mine-wrong/index', icon: '' },
  { label: '收藏题', path: '/pages/mine-favorites/index', icon: '' }
]

const MOCK_PROFILE: LearningProfile = {
  nickname: 'Spark 学员',
  goal: ['高效刷题', '夯实期末重点'],
  knowledge_level: 'Python 基础',
  weak_points: ['递归思维', '动态规划', '概率统计'],
  learning_preference: ['例题演练', '短讲解', '错题复盘']
}

const MOCK_QUIZ_STATS: QuizStats = {
  total: 128,
  correct: 96,
  wrong: 32,
  accuracy: 0.75
}

const MOCK_DASHBOARD_STATS: DashboardStats = {
  study_days_this_week: 4,
  streak_days: 10,
  total_questions: 128
}

const MOCK_MASTERY: MasteryItem[] = [
  { knowledge_point_id: 'kp-array', knowledge_point_name: '数组与链表', score: 0.86 },
  { knowledge_point_id: 'kp-recursion', knowledge_point_name: '递归与分治', score: 0.68 },
  { knowledge_point_id: 'kp-dp', knowledge_point_name: '动态规划', score: 0.52 },
  { knowledge_point_id: 'kp-probability', knowledge_point_name: '概率统计', score: 0.74 }
]

const MOCK_WRONG_COUNT = 8
const MOCK_FAVORITE_COUNT = 12

function toArrayText(value?: string | string[]) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ') || '待积累'
  return value || '待积累'
}

export default function MinePage() {
  const [profile, setProfile] = useState<LearningProfile>(MOCK_PROFILE)
  const [quizStats, setQuizStats] = useState<QuizStats>(MOCK_QUIZ_STATS)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(MOCK_DASHBOARD_STATS)
  const [mastery, setMastery] = useState<MasteryItem[]>(MOCK_MASTERY)
  const [wrongCount, setWrongCount] = useState(MOCK_WRONG_COUNT)
  const [favoriteCount, setFavoriteCount] = useState(MOCK_FAVORITE_COUNT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stats = useMemo(() => [
    { label: '正确率', value: percentText(quizStats.accuracy) },
    { label: '累计答题', value: String(quizStats.total || dashboardStats.total_questions || 0) },
    { label: '错题', value: String(quizStats.wrong || wrongCount) },
    { label: '收藏', value: String(favoriteCount) }
  ], [dashboardStats.total_questions, favoriteCount, quizStats, wrongCount])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [profileData, statsData, masteryData, wrongItems, favoriteItems, dashboardData] = await Promise.allSettled([
        getProfile(),
        getQuizStats(),
        getMastery(),
        getWrongQuiz(),
        getFavorites(),
        getDashboardStats()
      ])

      if (profileData.status === 'fulfilled' && Object.keys(profileData.value || {}).length) {
        setProfile(profileData.value)
      }
      if (statsData.status === 'fulfilled' && statsData.value?.total) {
        setQuizStats(statsData.value)
      }
      if (masteryData.status === 'fulfilled' && Array.isArray(masteryData.value) && masteryData.value.length) {
        setMastery(masteryData.value)
      }
      if (wrongItems.status === 'fulfilled' && Array.isArray(wrongItems.value) && wrongItems.value.length) {
        setWrongCount(wrongItems.value.length)
      }
      if (favoriteItems.status === 'fulfilled' && Array.isArray(favoriteItems.value) && favoriteItems.value.length) {
        setFavoriteCount(favoriteItems.value.length)
      }
      if (dashboardData.status === 'fulfilled' && Object.keys(dashboardData.value || {}).length) {
        setDashboardStats(dashboardData.value)
      }
    } catch {
      setError('个人中心加载失败。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <View className='app-page mine-page'>
      <AppHeader eyebrow='Profile' title='我的'>
      </AppHeader>

      {error ? (
        <View className='inline-error'>
          <Text>{error}</Text>
          <Text className='inline-error__action' onClick={loadData}>重试</Text>
        </View>
      ) : null}

      <View className='profile-hero'>
        <View className='profile-avatar'>
          <Text>SL</Text>
        </View>
        <View className='profile-main'>
          <Text className='profile-name'>{profile?.nickname || profile?.name || 'Spark 学员'}</Text>
          <Text className='profile-status'>本周练习 {dashboardStats.study_days_this_week || dashboardStats.streak_days || 0} 天</Text>
        </View>
        <View className='profile-badge'>
          <View className='status-dot status-dot--green' />
          <Text>{loading ? '加载中' : '持续学习'}</Text>
        </View>
      </View>

      <View className='stats-grid'>
        {stats.map((item) => (
          <View key={item.label} className='stat-card'>
            <Text className='stat-value'>{item.value}</Text>
            <Text className='stat-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='profile-card'>
        <View className='section-head'>
          <Text className='section-title'>学习画像</Text>
          <Text className='section-link'>只展示</Text>
        </View>
        <View className='chip-cloud'>
          <Text className='profile-chip'>目标：{toArrayText(profile?.goal)}</Text>
          <Text className='profile-chip'>基础：{profile?.knowledge_level || profile?.major || '待积累'}</Text>
          <Text className='profile-chip'>薄弱点：{toArrayText(profile?.weak_points)}</Text>
          <Text className='profile-chip'>偏好：{toArrayText(profile?.learning_preference)}</Text>
        </View>
      </View>

      <View className='mastery-card'>
        <View className='section-head'>
          <Text className='section-title'>掌握度</Text>
          <Text className='section-link'>知识点</Text>
        </View>
        {mastery.length ? mastery.slice(0, 6).map((item) => {
          const score = typeof item.score === 'number' ? item.score : item.mastery || 0
          return (
            <View key={item.knowledge_point_id || item.name || item.knowledge_point_name} className='mastery-item'>
              <View className='mastery-row'>
                <Text>{item.knowledge_point_name || item.name || '知识点'}</Text>
                <Text>{percentText(score)}</Text>
              </View>
              <View className='mastery-track'>
                <View className='mastery-fill' style={{ width: percentText(score) }} />
              </View>
            </View>
          )
        }) : (
          <Text className='section-subtitle'>完成练习后会生成掌握度。</Text>
        )}
      </View>

      <View className='review-list'>
        {reviewItems.map((item, index) => (
          <View key={item.label} className='review-item' hoverClass='tap-active' onClick={() => Taro.navigateTo({ url: item.path })}>
            <View className={`review-icon review-icon--${['record', 'wrong', 'favorite'][index]}`} />
            <Text>{item.label}</Text>
            <Text className='review-arrow'>›</Text>
          </View>
        ))}
        <View className='review-item review-item--settings' hoverClass='tap-active' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <View className='review-icon review-icon--settings' />
          <Text>设置</Text>
          <Text className='review-arrow'>›</Text>
        </View>
      </View>

      <AppTabBar current='mine' />
    </View>
  )
}

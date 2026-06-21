import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AppIcon, { type AppIconName } from '../../components/AppIcon'
import AppTabBar from '../../components/AppTabBar'
import { getFavorites, getQuizStats, getWrongQuiz } from '../../services/quizApi'
import { getDashboardStats, getMastery, getProfile } from '../../services/profileApi'
import type { QuizStats } from '../../types/quiz'
import type { DashboardStats, LearningProfile, MasteryItem } from '../../types/profile'
import { percentText } from '../../utils/format'
import './index.scss'

const reviewItems: Array<{ label: string; path: string; icon: AppIconName; tone: string; desc: string }> = [
  { label: '答题记录', path: '/pages/mine-records/index', icon: 'history', tone: 'record', desc: '查看每次练习结果' },
  { label: '错题本', path: '/pages/mine-wrong/index', icon: 'warning', tone: 'wrong', desc: '集中复盘薄弱题' },
  { label: '收藏题', path: '/pages/mine-favorites/index', icon: 'bookmark', tone: 'favorite', desc: '保存值得回看的题' }
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

function normalizeRatio(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value <= 1 ? value : value / 100))
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

  const weakPointText = toArrayText(profile?.weak_points)
  const goalText = toArrayText(profile?.goal)
  const accuracyRatio = normalizeRatio(quizStats.accuracy)
  const accuracyDegree = Math.round(accuracyRatio * 360)
  const totalQuestions = quizStats.total || dashboardStats.total_questions || 0
  const practiceDays = dashboardStats.study_days_this_week || dashboardStats.streak_days || 0
  const chartBars = useMemo(() => {
    const items = [
      { label: '正确', value: quizStats.correct || 0, tone: 'correct' },
      { label: '错题', value: quizStats.wrong || wrongCount || 0, tone: 'wrong' },
      { label: '收藏', value: favoriteCount || 0, tone: 'favorite' },
      { label: '天数', value: practiceDays || 0, tone: 'days' }
    ]
    const maxValue = Math.max(...items.map((item) => item.value), 1)
    return items.map((item) => ({
      ...item,
      height: `${Math.max(12, Math.round((item.value / maxValue) * 100))}%`
    }))
  }, [favoriteCount, practiceDays, quizStats.correct, quizStats.wrong, wrongCount])

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
        <View className='profile-main'>
          <Text className='profile-kicker'>学习控制台</Text>
          <Text className='profile-title'>练习数据看板</Text>
          <Text className='profile-status'>累计 {totalQuestions} 题 · 本周练习 {practiceDays} 天</Text>
        </View>
        <View className='profile-badge'>
          <AppIcon name={loading ? 'sparkles' : 'trophy'} />
          <Text>{loading ? '加载中' : '持续学习'}</Text>
        </View>
      </View>

      <View className='charts-panel'>
        <View className='accuracy-chart'>
          <View
            className='accuracy-ring'
            style={{
              background: `conic-gradient(#2367f4 0deg ${accuracyDegree}deg, #e8f1ff ${accuracyDegree}deg 360deg)`
            }}
          >
            <View className='accuracy-ring__inner'>
              <Text className='accuracy-ring__value'>{percentText(quizStats.accuracy)}</Text>
              <Text className='accuracy-ring__label'>正确率</Text>
            </View>
          </View>
          <View className='accuracy-meta'>
            <Text className='chart-title'>学习表现</Text>
            <Text className='chart-desc'>正确 {quizStats.correct || 0} 题，错题 {quizStats.wrong || wrongCount || 0} 题</Text>
            <View className='chart-legend'>
              <Text className='legend-item legend-item--blue'>正确率</Text>
              <Text className='legend-item legend-item--soft'>待提升</Text>
            </View>
          </View>
        </View>

        <View className='bar-chart'>
          <View className='bar-chart__head'>
            <Text className='chart-title'>学习数据</Text>
            <Text className='section-link'>图表</Text>
          </View>
          <View className='bar-chart__body'>
            {chartBars.map((item) => (
              <View key={item.label} className='bar-item'>
                <View className='bar-track'>
                  <View className={`bar-fill bar-fill--${item.tone}`} style={{ height: item.height }} />
                </View>
                <Text className='bar-value'>{item.value}</Text>
                <Text className='bar-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className='quick-grid'>
        {reviewItems.map((item) => (
          <View key={item.label} className={`quick-card quick-card--${item.tone}`} hoverClass='tap-active' onClick={() => Taro.navigateTo({ url: item.path })}>
            <View className='quick-icon'>
              <AppIcon name={item.icon} />
            </View>
            <Text className='quick-title'>{item.label}</Text>
            <Text className='quick-desc'>{item.desc}</Text>
          </View>
        ))}
        <View className='quick-card quick-card--settings' hoverClass='tap-active' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
          <View className='quick-icon'>
            <AppIcon name='settings' />
          </View>
          <Text className='quick-title'>设置</Text>
          <Text className='quick-desc'>管理偏好和账号</Text>
        </View>
      </View>

      <View className='profile-card'>
        <View className='section-head'>
          <View className='section-title-row'>
            <AppIcon name='medal' />
            <Text className='section-title'>学习画像</Text>
          </View>
          <Text className='section-link'>图标概览</Text>
        </View>
        <View className='chip-cloud'>
          <View className='profile-chip'>
            <AppIcon name='trophy' />
            <Text>目标：{goalText}</Text>
          </View>
          <View className='profile-chip'>
            <AppIcon name='book' />
            <Text>基础：{profile?.knowledge_level || profile?.major || '待积累'}</Text>
          </View>
          <View className='profile-chip'>
            <AppIcon name='warning' />
            <Text>薄弱点：{weakPointText}</Text>
          </View>
          <View className='profile-chip'>
            <AppIcon name='sparkles' />
            <Text>偏好：{toArrayText(profile?.learning_preference)}</Text>
          </View>
        </View>
      </View>

      <View className='mastery-card'>
        <View className='section-head'>
          <View className='section-title-row'>
            <AppIcon name='chart' />
            <Text className='section-title'>掌握度</Text>
          </View>
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

      <AppTabBar current='mine' />
    </View>
  )
}

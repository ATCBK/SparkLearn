import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import AppIcon, { type AppIconName } from '../AppIcon'
import './index.scss'

type TabKey = 'tutor' | 'quiz' | 'mine'

const tabs: Array<{ key: TabKey; label: string; path: string; icon: AppIconName }> = [
  { key: 'tutor', label: 'AI助学', path: '/pages/tutor/index', icon: 'bot' },
  { key: 'quiz', label: '练习', path: '/pages/quiz/index', icon: 'quiz' },
  { key: 'mine', label: '我的', path: '/pages/mine/index', icon: 'user' },
]

type AppTabBarProps = {
  current: TabKey
}

export default function AppTabBar({ current }: AppTabBarProps) {
  const handleTap = (path: string, key: TabKey) => {
    if (key === current) return
    Taro.redirectTo({ url: path })
  }

  return (
    <View className='app-tabbar'>
      {tabs.map((tab) => (
        <View
          key={tab.key}
          className={`app-tabbar__item ${current === tab.key ? 'is-active' : ''}`}
          hoverClass='tap-active'
          onClick={() => handleTap(tab.path, tab.key)}
        >
          <AppIcon name={tab.icon} className='app-tabbar__icon' />
          <Text className='app-tabbar__label'>{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}

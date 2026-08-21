import { PropsWithChildren, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import './index.scss'

type HeaderMetrics = {
  statusBarHeight: number
  barHeight: number
  contentHeight: number
  rightInset: number
}

type AppHeaderProps = PropsWithChildren<{
  eyebrow?: string
  title: string
}>

const fallbackMetrics: HeaderMetrics = {
  statusBarHeight: 20,
  barHeight: 48,
  contentHeight: 32,
  rightInset: 108
}

function getHeaderMetrics(): HeaderMetrics {
  try {
    const windowInfo = Taro.getWindowInfo()
    const menu = Taro.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || fallbackMetrics.statusBarHeight
    const windowWidth = windowInfo.windowWidth || 375

    if (!menu || !menu.height || !menu.top || !menu.left) {
      return fallbackMetrics
    }

    const topGap = Math.max(menu.top - statusBarHeight, 4)

    return {
      statusBarHeight,
      barHeight: menu.height + topGap * 2,
      contentHeight: menu.height,
      rightInset: Math.max(windowWidth - menu.left + 8, fallbackMetrics.rightInset)
    }
  } catch {
    return fallbackMetrics
  }
}

export default function AppHeader({ eyebrow = 'SparkLearn', title, children }: AppHeaderProps) {
  const metrics = useMemo(() => getHeaderMetrics(), [])
  const headerHeight = metrics.statusBarHeight + metrics.barHeight

  return (
    <View
      className='app-header'
      style={{
        height: `${headerHeight}px`
      }}
    >
      <View
        className='app-header__fixed'
        style={{
          paddingTop: `${metrics.statusBarHeight}px`,
          paddingRight: `${metrics.rightInset}px`,
          minHeight: `${headerHeight}px`
        }}
      >
        <View className='app-header__bar' style={{ minHeight: `${metrics.contentHeight}px` }}>
          <View className='app-header__main'>
            <Text className='app-header__eyebrow'>{eyebrow}</Text>
            <Text className='app-header__title'>{title}</Text>
          </View>
          {children ? <View className='app-header__actions'>{children}</View> : null}
        </View>
      </View>
    </View>
  )
}

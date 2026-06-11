import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import AppHeader from '../../components/AppHeader'
import { getApiBaseUrl } from '../../services/profileApi'
import { clearToken } from '../../utils/storage'
import './index.scss'

export default function SettingsPage() {
  const clearCache = () => {
    Taro.clearStorageSync()
    Taro.showToast({ title: '缓存已清理', icon: 'none' })
  }

  const logout = () => {
    clearToken()
    Taro.showToast({ title: '已退出登录', icon: 'none' })
    Taro.redirectTo({ url: '/pages/tutor/index' })
  }

  return (
    <View className='app-page sub-page'>
      <AppHeader eyebrow='Settings' title='设置'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </AppHeader>

      <View className='sub-list'>
        <View className='sub-card'>
          <Text className='sub-title'>账号信息</Text>
          <Text className='setting-value'>当前使用微信小程序本地登录态；若后端开启微信登录，请求会自动携带 token。</Text>
        </View>
        <View className='sub-card'>
          <Text className='sub-title'>后端地址</Text>
          <Text className='setting-value'>{getApiBaseUrl()}</Text>
        </View>
        <View className='sub-card' hoverClass='tap-active' onClick={clearCache}>
          <Text className='sub-title'>清缓存</Text>
          <Text className='setting-value'>清理本地 token、问 AI 上下文和页面缓存。</Text>
        </View>
        <View className='sub-card' hoverClass='tap-active' onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}>
          <Text className='sub-title'>隐私协议</Text>
          <Text className='setting-value'>查看学习数据、文件和语音输入说明。</Text>
        </View>
        <View className='sub-card' hoverClass='tap-active' onClick={logout}>
          <Text className='sub-title'>退出登录</Text>
          <Text className='setting-value'>清除本地登录状态并回到 AI 助学。</Text>
        </View>
      </View>
    </View>
  )
}

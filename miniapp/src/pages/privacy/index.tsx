import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import AppHeader from '../../components/AppHeader'
import './index.scss'

export default function PrivacyPage() {
  return (
    <View className='app-page sub-page'>
      <AppHeader eyebrow='Privacy' title='隐私协议'>
        <View className='icon-button' hoverClass='tap-active' onClick={() => Taro.navigateBack()}>
          <Text>返回</Text>
        </View>
      </AppHeader>

      <View className='sub-card'>
        <Text className='sub-title'>数据使用说明</Text>
        <Text className='privacy-text'>SparkLearn 会使用你的学习问题、答题记录、错题、收藏题和上传资料，为 AI 助学、刷题反馈和学习画像提供服务。</Text>
        <Text className='privacy-text'>语音输入在小程序端完成录音与识别后，以文本形式进入 AI 对话。图片在本期仅作为本地附件预览，不作为 AI 视觉理解输入。</Text>
        <Text className='privacy-text'>你可以在设置页清理本地缓存或退出登录。退出登录不会自动删除服务端已有学习记录。</Text>
      </View>
    </View>
  )
}

import { View } from '@tarojs/components'
import './index.scss'

export type AppIconName =
  | 'bot'
  | 'sparkles'
  | 'users'
  | 'globe'
  | 'cpu'
  | 'shield'
  | 'image'
  | 'mic'
  | 'send'
  | 'plus'
  | 'book'
  | 'quiz'
  | 'user'
  | 'folder'

type AppIconProps = {
  name: AppIconName
  className?: string
}

export default function AppIcon({ name, className = '' }: AppIconProps) {
  return (
    <View className={`app-icon app-icon--${name} ${className}`.trim()}>
      <View className='app-icon__mark' />
    </View>
  )
}

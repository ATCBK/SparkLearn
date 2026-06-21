import { Text } from '@tarojs/components'
import './index.scss'

export type AppIconName =
  | 'bot'
  | 'sparkles'
  | 'users'
  | 'globe'
  | 'cpu'
  | 'shield'
  | 'image'
  | 'video'
  | 'mic'
  | 'send'
  | 'plus'
  | 'book'
  | 'quiz'
  | 'user'
  | 'folder'
  | 'history'
  | 'warning'
  | 'bookmark'
  | 'settings'
  | 'chart'
  | 'calendar'
  | 'trophy'
  | 'brain'
  | 'medal'

type AppIconProps = {
  name: AppIconName
  className?: string
}

const iconCodepoints: Record<AppIconName, number> = {
  bot: 0xf3d8,
  sparkles: 0xf36b,
  users: 0xede3,
  globe: 0xedcf,
  cpu: 0xebf0,
  shield: 0xf100,
  image: 0xee4b,
  video: 0xf282,
  mic: 0xef50,
  send: 0xf0d7,
  plus: 0xea13,
  book: 0xeadb,
  quiz: 0xeb81,
  user: 0xf256,
  folder: 0xed54,
  history: 0xee17,
  warning: 0xeca1,
  bookmark: 0xeae5,
  settings: 0xf0ee,
  chart: 0xeeab,
  calendar: 0xeb23,
  trophy: 0xf22f,
  brain: 0xf2f7,
  medal: 0xef28,
}

export default function AppIcon({ name, className = '' }: AppIconProps) {
  return (
    <Text className={`app-icon app-icon--${name} ${className}`.trim()} aria-hidden='true'>
      {String.fromCharCode(iconCodepoints[name])}
    </Text>
  )
}

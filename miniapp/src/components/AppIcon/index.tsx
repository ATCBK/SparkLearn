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

function renderIcon(name: AppIconName) {
  switch (name) {
    case 'plus':
      return (
        <>
          <View className='app-icon__stroke app-icon__stroke--plus-h' />
          <View className='app-icon__stroke app-icon__stroke--plus-v' />
        </>
      )
    case 'send':
      return (
        <>
          <View className='app-icon__stroke app-icon__send-body' />
          <View className='app-icon__stroke app-icon__send-tail' />
        </>
      )
    case 'mic':
      return (
        <>
          <View className='app-icon__outline app-icon__mic-body' />
          <View className='app-icon__stroke app-icon__mic-stem' />
          <View className='app-icon__stroke app-icon__mic-base' />
          <View className='app-icon__arc app-icon__mic-arc' />
        </>
      )
    case 'image':
      return (
        <>
          <View className='app-icon__outline app-icon__image-frame' />
          <View className='app-icon__fill-dot app-icon__image-sun' />
          <View className='app-icon__stroke app-icon__image-mountain-left' />
          <View className='app-icon__stroke app-icon__image-mountain-right' />
        </>
      )
    case 'shield':
      return <View className='app-icon__shield' />
    case 'globe':
      return (
        <>
          <View className='app-icon__outline app-icon__globe-ring' />
          <View className='app-icon__stroke app-icon__globe-equator' />
          <View className='app-icon__outline app-icon__globe-meridian app-icon__globe-meridian--left' />
          <View className='app-icon__outline app-icon__globe-meridian app-icon__globe-meridian--right' />
        </>
      )
    case 'cpu':
      return (
        <>
          <View className='app-icon__outline app-icon__cpu-core' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--top-left' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--top-right' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--bottom-left' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--bottom-right' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--left-top' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--left-bottom' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--right-top' />
          <View className='app-icon__stroke app-icon__cpu-pin app-icon__cpu-pin--right-bottom' />
        </>
      )
    case 'sparkles':
      return (
        <>
          <View className='app-icon__spark app-icon__spark-main' />
          <View className='app-icon__stroke app-icon__spark-small-h' />
          <View className='app-icon__stroke app-icon__spark-small-v' />
        </>
      )
    case 'users':
      return (
        <>
          <View className='app-icon__outline app-icon__users-head app-icon__users-head--left' />
          <View className='app-icon__outline app-icon__users-head app-icon__users-head--right' />
          <View className='app-icon__arc app-icon__users-body app-icon__users-body--left' />
          <View className='app-icon__arc app-icon__users-body app-icon__users-body--right' />
        </>
      )
    case 'bot':
      return (
        <>
          <View className='app-icon__stroke app-icon__bot-antenna' />
          <View className='app-icon__fill-dot app-icon__bot-antenna-dot' />
          <View className='app-icon__outline app-icon__bot-head' />
          <View className='app-icon__fill-dot app-icon__bot-eye app-icon__bot-eye--left' />
          <View className='app-icon__fill-dot app-icon__bot-eye app-icon__bot-eye--right' />
          <View className='app-icon__stroke app-icon__bot-mouth' />
        </>
      )
    case 'book':
      return (
        <>
          <View className='app-icon__outline app-icon__book-cover' />
          <View className='app-icon__stroke app-icon__book-spine' />
          <View className='app-icon__stroke app-icon__book-page' />
        </>
      )
    case 'quiz':
      return (
        <>
          <View className='app-icon__outline app-icon__quiz-box' />
          <View className='app-icon__stroke app-icon__quiz-check-left' />
          <View className='app-icon__stroke app-icon__quiz-check-right' />
        </>
      )
    case 'user':
      return (
        <>
          <View className='app-icon__outline app-icon__user-head' />
          <View className='app-icon__arc app-icon__user-body' />
        </>
      )
    case 'folder':
      return (
        <>
          <View className='app-icon__outline app-icon__folder-body' />
          <View className='app-icon__outline app-icon__folder-tab' />
        </>
      )
    default:
      return null
  }
}

export default function AppIcon({ name, className = '' }: AppIconProps) {
  return (
    <View className={`app-icon app-icon--${name} ${className}`.trim()} aria-hidden='true'>
      <View className='app-icon__canvas'>{renderIcon(name)}</View>
    </View>
  )
}

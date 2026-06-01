export interface AvatarPreset {
  id: string
  name: string
  gender: 'male' | 'female' | 'neutral'
  style: string
  description?: string
}

const DEFAULT_LOCAL_MODEL = '/avatars/default-avatar.glb'

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'default', name: '冬奥礼仪', gender: 'female', style: '正式-玫红套装', description: '短发女性数字人，玫红西装套裙，北京冬奥会礼仪制服风格' },
  { id: 'xiaozhi', name: '小智', gender: 'male', style: 'casual' },
]

export function getAvatarUrl(avatarId: string): string {
  if (avatarId === 'default' || avatarId === 'xiaozhi' || !avatarId) {
    return DEFAULT_LOCAL_MODEL
  }
  // Ready Player Me avatar IDs are 24-char hex strings
  if (/^[0-9a-fA-F]{24}$/.test(avatarId)) {
    return `https://models.readyplayer.me/${avatarId}.glb`
  }
  return DEFAULT_LOCAL_MODEL
}

export const DEFAULT_AVATAR = AVATAR_PRESETS[0]

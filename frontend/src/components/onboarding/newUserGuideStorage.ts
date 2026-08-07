const GUIDE_SEEN_PREFIX = 'sparklearn_new_user_guide_seen:'
const GUIDE_PROGRESS_PREFIX = 'sparklearn_new_user_guide_progress:'

export const NEW_USER_GUIDE_STEP_IDS = [
  'home',
  'profile',
  'profile-view',
  'path',
  'path-node',
  'resource',
  'resource-note',
  'knowledge',
  'agent',
  'practice',
  'practice-records',
  'report',
  'info-stream',
  'plaza',
  'plaza-return',
  'ai-sprite',
  'ai-learning-space',
  'tutor-role',
  'tutor-chat',
  'workshop',
  'finish',
]

function safeLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getGuideUserId() {
  const storage = safeLocalStorage()
  if (!storage) return 'anonymous'
  try {
    const raw = storage.getItem('sparklearn_user')
    if (!raw) return 'anonymous'
    const user = JSON.parse(raw) as { user_id?: string; id?: string; email?: string; name?: string }
    return String(user.user_id || user.id || user.email || user.name || 'anonymous')
  } catch {
    return 'anonymous'
  }
}

function seenKey(userId = getGuideUserId()) {
  return `${GUIDE_SEEN_PREFIX}${userId || 'anonymous'}`
}

function progressKey(userId = getGuideUserId()) {
  return `${GUIDE_PROGRESS_PREFIX}${userId || 'anonymous'}`
}

export function hasSeenNewUserGuide(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  return storage?.getItem(seenKey(userId)) === 'true'
}

export function markNewUserGuideSeen(userId = getGuideUserId()) {
  safeLocalStorage()?.setItem(seenKey(userId), 'true')
}

export function readNewUserGuideProgress(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(progressKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && NEW_USER_GUIDE_STEP_IDS.includes(id))
  } catch {
    return []
  }
}

export function writeNewUserGuideProgress(stepIds: string[], userId = getGuideUserId()) {
  const unique = Array.from(new Set(stepIds)).filter((id) => NEW_USER_GUIDE_STEP_IDS.includes(id))
  safeLocalStorage()?.setItem(progressKey(userId), JSON.stringify(unique))
}

export function clearNewUserGuideSession(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  storage?.removeItem(seenKey(userId))
  storage?.removeItem(progressKey(userId))
}

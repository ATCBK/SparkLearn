const GUIDE_SEEN_PREFIX = 'sparklearn_new_user_guide_seen:'
const GUIDE_PROGRESS_PREFIX = 'sparklearn_new_user_guide_progress:'
const GUIDE_ACTIVE_PREFIX = 'sparklearn_new_user_guide_active:'

export const NEW_USER_GUIDE_STEP_IDS = [
  'home',
  'profile',
  'path',
  'records',
  'resource',
  'tutor',
  'practice',
  'report',
]

function safeLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getUserIdFromToken(token: string | null) {
  if (!token) return ''
  const payloadPart = token.split('.')[1]
  if (!payloadPart) return ''
  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { sub?: string; user_id?: string; id?: string; email?: string }
    return String(payload.sub || payload.user_id || payload.id || payload.email || '')
  } catch {
    return ''
  }
}

export function getGuideUserId() {
  const storage = safeLocalStorage()
  if (!storage) return 'anonymous'
  try {
    const tokenUserId = getUserIdFromToken(storage.getItem('sparklearn_token'))
    const raw = storage.getItem('sparklearn_user')
    if (!raw) return tokenUserId || (storage.getItem('sparklearn_token') ? '' : 'anonymous')
    const user = JSON.parse(raw) as { user_id?: string; id?: string; email?: string; name?: string }
    const userId = String(user.user_id || user.id || user.email || user.name || '')
    return userId || tokenUserId || (storage.getItem('sparklearn_token') ? '' : 'anonymous')
  } catch {
    const tokenUserId = getUserIdFromToken(storage.getItem('sparklearn_token'))
    return tokenUserId || (storage.getItem('sparklearn_token') ? '' : 'anonymous')
  }
}

function seenKey(userId = getGuideUserId()) {
  return `${GUIDE_SEEN_PREFIX}${userId || 'anonymous'}`
}

function progressKey(userId = getGuideUserId()) {
  return `${GUIDE_PROGRESS_PREFIX}${userId || 'anonymous'}`
}

function activeKey(userId = getGuideUserId()) {
  return `${GUIDE_ACTIVE_PREFIX}${userId || 'anonymous'}`
}

export function hasSeenNewUserGuide(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  return storage?.getItem(seenKey(userId)) === 'true'
}

export function markNewUserGuideSeen(userId = getGuideUserId()) {
  safeLocalStorage()?.setItem(seenKey(userId), 'true')
}

export function isNewUserGuideActive(userId = getGuideUserId()) {
  const storage = safeLocalStorage()
  return storage?.getItem(activeKey(userId)) === 'true'
}

export function markNewUserGuideActive(userId = getGuideUserId()) {
  safeLocalStorage()?.setItem(activeKey(userId), 'true')
}

export function clearNewUserGuideActive(userId = getGuideUserId()) {
  safeLocalStorage()?.removeItem(activeKey(userId))
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
  storage?.removeItem(activeKey(userId))
}

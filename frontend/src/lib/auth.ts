const TOKEN_KEY = 'sparklearn_token'
const USER_KEY = 'sparklearn_user'

type DesktopAuthSession = {
  token: string
  user: AuthUser
  updatedAt?: string
}

export type SparklearnDesktopBridge = {
  getAuthSession?: () => Promise<DesktopAuthSession | null>
  saveAuthSession?: (payload: { token: string; user: AuthUser }) => Promise<DesktopAuthSession>
  clearAuthSession?: () => Promise<{ cleared: boolean }>
  syncStudyBuddyProfile?: (payload?: { source?: string; user?: AuthUser }) => Promise<unknown>
  openStudyBuddyConfig?: () => Promise<void> | void
}

declare global {
  interface Window {
    sparklearnDesktop?: SparklearnDesktopBridge
  }
}

export interface AuthUser {
  user_id?: string
  name: string
  phone?: string
  email?: string
  loginAt?: string
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setUser(user: AuthUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getDesktopBridge(): SparklearnDesktopBridge | null {
  if (typeof window === 'undefined') return null
  return window.sparklearnDesktop || null
}

export async function persistDesktopAuthSession(token?: string | null, user?: AuthUser | null): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge?.saveAuthSession || !token || !user) return
  try {
    await bridge.saveAuthSession({ token, user })
  } catch {
    // Ignore desktop persistence failures; browser localStorage remains the fallback.
  }
}

export async function restoreDesktopAuthSession(): Promise<boolean> {
  const bridge = getDesktopBridge()
  if (!bridge?.getAuthSession) return false
  try {
    const session = await bridge.getAuthSession()
    if (!session?.token || !session?.user) return false
    setToken(session.token)
    setUser(session.user)
    return true
  } catch {
    return false
  }
}

export async function clearDesktopAuthSession(): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge?.clearAuthSession) return
  try {
    await bridge.clearAuthSession()
  } catch {
    // Ignore desktop cleanup failures.
  }
}

export async function syncStudyBuddyProfile(source: string = 'desktop-ui'): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge?.syncStudyBuddyProfile) return
  try {
    await bridge.syncStudyBuddyProfile({
      source,
      user: getUser() || undefined,
    })
  } catch {
    // Ignore sync failures; profile data still lives in backend storage.
  }
}

function base64UrlEncode(value: object): string {
  const json = JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function createMockAuthSession(
  phone: string = '13800000000',
  name: string = '模拟用户',
): { token: string; user: AuthUser } {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    user_id: 'single_user',
    phone,
    name,
    loginAt: new Date().toISOString(),
  }
  const token = [
    base64UrlEncode({ alg: 'HS256', typ: 'JWT' }),
    base64UrlEncode({ sub: user.user_id, name, phone, iat: now, exp: now + 72 * 60 * 60 }),
    'mock-signature',
  ].join('.')

  setToken(token)
  setUser(user)
  localStorage.setItem('sparklearn_profile_needs_recapture', 'true')
  return { token, user }
}

export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true
  const payloadPart = token.split('.')[1]
  if (!payloadPart) return false

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: number }
    return payload.exp ? Date.now() >= payload.exp * 1000 : false
  } catch {
    return false
  }
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  if (isTokenExpired()) {
    removeToken()
    return false
  }
  return true
}

export function logout(): void {
  removeToken()
  void clearDesktopAuthSession()
  if (typeof window !== 'undefined') {
    window.location.href = '/auth'
  }
}

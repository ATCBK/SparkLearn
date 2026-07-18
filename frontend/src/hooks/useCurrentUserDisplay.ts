'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { getUser, setUser, type AuthUser } from '@/lib/auth'

export type CurrentUserDisplay = {
  name: string
  nameChar: string
  avatarUrl: string
}

const FALLBACK_USER_NAME = '当前学习者'
const FALLBACK_NAME_CHAR = '学'

function normalizeUser(user: (AuthUser & { avatar?: string }) | null): CurrentUserDisplay {
  const name = (user?.name || '').trim() || FALLBACK_USER_NAME
  return {
    name,
    nameChar: name ? name[0] : FALLBACK_NAME_CHAR,
    avatarUrl: (user?.avatar || '').trim(),
  }
}

function readStoredUser() {
  return normalizeUser(getUser() as (AuthUser & { avatar?: string }) | null)
}

export function useCurrentUserDisplay(): CurrentUserDisplay {
  const [display, setDisplay] = useState<CurrentUserDisplay>(() => (
    typeof window === 'undefined'
      ? { name: FALLBACK_USER_NAME, nameChar: FALLBACK_NAME_CHAR, avatarUrl: '' }
      : readStoredUser()
  ))

  useEffect(() => {
    let cancelled = false

    const refreshFromStorage = () => {
      if (!cancelled) setDisplay(readStoredUser())
    }

    refreshFromStorage()
    window.addEventListener('storage', refreshFromStorage)
    window.addEventListener('sparklearn:user-updated', refreshFromStorage)

    ;(async () => {
      try {
        const profile = await api.getProfile()
        if (cancelled || !profile?.name?.trim()) return

        const current = getUser()
        const nextDisplay = normalizeUser({ ...(current || { user_id: profile.id }), name: profile.name.trim() })
        setDisplay(nextDisplay)
        if (current) {
          setUser({
            ...current,
            user_id: current.user_id || profile.id,
            name: profile.name.trim(),
          })
          window.dispatchEvent(new Event('sparklearn:user-updated'))
        }
      } catch {
        // 登录态里的用户信息仍可作为展示兜底。
      }
    })()

    return () => {
      cancelled = true
      window.removeEventListener('storage', refreshFromStorage)
      window.removeEventListener('sparklearn:user-updated', refreshFromStorage)
    }
  }, [])

  return useMemo(() => display, [display])
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { KeyRound, Shield, Smartphone } from 'lucide-react'
import {
  isAuthenticated,
  persistDesktopAuthSession,
  restoreDesktopAuthSession,
  setToken,
  setUser,
  syncStudyBuddyProfile,
} from '@/lib/auth'
import { checkPhoneRegistered, getProfile, sendSmsCode, smsLogin, smsRegister } from '@/lib/api/real'
import './auth.css'

const SLOGANS = [
  '基于学习目标、当前基础和偏好生成个性化学习路径。',
  '把学习画像、资源推荐、练习反馈和报告串成闭环。',
  '优先定位薄弱点，再给出更可执行的下一步动作。',
  '随着学习行为积累，StudyBuddy 会越来越理解你的节奏。',
] as const

<<<<<<< HEAD
=======

>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
type AuthResultUser = {
  id?: string
  user_id?: string
  name?: string
  phone?: string
}

function profileCollectedKey(userId?: string) {
  return userId ? `sparklearn_profile_collected_at:${userId}` : 'sparklearn_profile_collected_at'
}

function getAuthUserId(user: AuthResultUser | null | undefined) {
  return String(user?.user_id || user?.id || '')
}

function isProfileComplete(profile: {
  major?: string
  goals?: unknown[]
  knowledgeLevel?: string
  weakPoints?: unknown[]
  learningPreference?: unknown[]
} | null | undefined) {
  return Boolean(
    profile
    && String(profile.major || '').trim()
    && Array.isArray(profile.goals)
    && profile.goals.length > 0
    && String(profile.knowledgeLevel || '').trim()
    && Array.isArray(profile.weakPoints)
    && profile.weakPoints.length > 0
    && Array.isArray(profile.learningPreference)
    && profile.learningPreference.length > 0
  )
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [sloganIndex, setSloganIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const currentSlogan = useMemo(() => SLOGANS[sloganIndex], [sloganIndex])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      await restoreDesktopAuthSession()
      if (!cancelled && isAuthenticated()) {
        router.replace('/')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    if (!isDeleting) {
      if (displayText.length < currentSlogan.length) {
        timerRef.current = setTimeout(() => {
          setDisplayText(currentSlogan.slice(0, displayText.length + 1))
        }, 50)
      } else {
        timerRef.current = setTimeout(() => setIsDeleting(true), 2200)
      }
    } else if (displayText.length > 0) {
      timerRef.current = setTimeout(() => {
        setDisplayText(displayText.slice(0, -1))
      }, 25)
    } else {
      setIsDeleting(false)
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentSlogan, displayText, isDeleting])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

<<<<<<< HEAD
=======

>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
  const showToast = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 2200)
  }, [])

  async function resolvePostAuthRoute(user: AuthResultUser | null | undefined, isNewRegistration: boolean) {
    if (isNewRegistration) return '/onboarding'

    if (typeof window !== 'undefined') {
      const userId = getAuthUserId(user)
      if (
        localStorage.getItem(profileCollectedKey(userId))
        || localStorage.getItem(profileCollectedKey())
      ) {
        return '/'
      }
    }

    try {
      const profile = await getProfile()
      if (isProfileComplete(profile)) {
        return '/'
      }
    } catch {
      // No saved profile yet.
    }

    return '/onboarding'
  }

  async function handleSendCode() {
    if (phone.length !== 11) {
      showToast('请输入正确的11位手机号')
      return
    }

    try {
      setLoading(true)

      if (mode === 'login') {
        const { registered } = await checkPhoneRegistered(phone)
        if (!registered) {
          showToast('该手机号未注册，请先注册')
          setMode('register')
          return
        }
      }

      await sendSmsCode(phone, mode)
      setCodeSent(true)
      setCountdown(60)
      showToast('验证码已发送')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (phone.length !== 11) {
      showToast('请输入正确的11位手机号')
      return
    }
    if (code.length !== 6) {
      showToast('请输入6位验证码')
      return
    }

    setLoading(true)
    try {
      const result = mode === 'login'
        ? await smsLogin(phone, code)
        : await smsRegister(phone, code, name)

      const authUser = {
        ...result.user,
        user_id: getAuthUserId(result.user),
      }

      setToken(result.token)
      setUser(authUser)
      await persistDesktopAuthSession(result.token, authUser)
      await syncStudyBuddyProfile('auth-success')

      showToast(mode === 'login' ? '登录成功' : '注册成功')
      const nextRoute = await resolvePostAuthRoute(authUser, mode === 'register')
      setTimeout(() => router.push(nextRoute), 400)
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败'
      if (mode === 'login' && message.includes('未注册')) {
        showToast('该手机号未注册，请先注册')
        setMode('register')
      } else {
        showToast(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <main className="auth-page">
      <div className="brand">
        <Image
          src="/sparklearn-logo.png"
          alt="SparkLearn"
          width={68}
          height={56}
          className="brand-logo"
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
        <div>
          <strong className="brand-name">SparkLearn</strong>
          <span className="brand-sub">智能个性化学习平台</span>
        </div>
      </div>

      <section className="layout">
        <div className="intro">
          <h1 className="intro-title">
            让学习更懂你
            <span className="intro-title-accent">成就每一步进展</span>
          </h1>
          <p className="intro-desc">
            {displayText}
            <span className="typewriter-cursor">|</span>
          </p>

          <div className="feature-row">
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <Shield className="h-[18px] w-[18px]" />
              </div>
              <h2 className="feature-title">学习画像</h2>
              <p className="feature-desc">基于你的目标、基础与偏好持续更新学习认知。</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <Smartphone className="h-[18px] w-[18px]" />
              </div>
              <h2 className="feature-title">多端连续</h2>
              <p className="feature-desc">桌面端只需登录一次，StudyBuddy 会继续承接你的状态。</p>
            </article>
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <KeyRound className="h-[18px] w-[18px]" />
              </div>
              <h2 className="feature-title">下一步建议</h2>
              <p className="feature-desc">把路径、资源、练习和报告整合成可执行动作。</p>
            </article>
          </div>
        </div>

        <aside className="login-card">
          <h2 className="login-title">{isLogin ? '欢迎回来' : '创建账号'}</h2>
          <p className="login-sub">
            {isLogin ? '继续你的个性化学习旅程' : '注册后开始你的 StudyBuddy 学习闭环'}
          </p>

          <div className="tabs" role="tablist" aria-label="登录注册切换">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => {
                setMode('login')
                setCodeSent(false)
                setCode('')
              }}
            >
              登录
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={!isLogin}
              onClick={() => {
                setMode('register')
                setCodeSent(false)
                setCode('')
              }}
            >
              注册
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <Smartphone className="field-icon" size={18} strokeWidth={2} />
              <input
                type="tel"
                placeholder="请输入手机号"
                autoComplete="tel"
                maxLength={11}
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
              />
            </div>

            {!isLogin ? (
              <div className="field">
                <Shield className="field-icon" size={18} strokeWidth={2} />
                <input
                  type="text"
                  placeholder="请输入昵称（选填）"
                  maxLength={50}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            ) : null}

            <div className="field code-field">
              <KeyRound className="field-icon" size={18} strokeWidth={2} />
              <input
                type="text"
                placeholder="请输入6位验证码"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
              <button
                className="send-code-btn"
                type="button"
                onClick={() => void handleSendCode()}
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : codeSent ? '重新发送' : '获取验证码'}
              </button>
            </div>

<<<<<<< HEAD
=======

>>>>>>> 04da7d704e5bd015542a61107308a98fae4ea4b1
            <div className="form-row">
              <label className="check-label">
                <input type="checkbox" defaultChecked />
                <span>记住桌面端登录状态</span>
              </label>
            </div>

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? (isLogin ? '正在登录...' : '正在注册...') : (isLogin ? '立即登录' : '立即注册')}
            </button>
          </form>

          <div className="agreement">
            <Shield size={18} className="text-[#8a99b0]" />
            <span>
              登录即表示同意
              {' '}
              <a href="#" onClick={(event) => event.preventDefault()}>《用户协议》</a>
              {' '}
              与
              {' '}
              <a href="#" onClick={(event) => event.preventDefault()}>《隐私政策》</a>
            </span>
          </div>
        </aside>
      </section>

      <div className={`toast ${toast ? 'show' : ''}`}>
        {toast}
      </div>
    </main>
  )
}

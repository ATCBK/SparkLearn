'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesCombined,
  CheckCircle2,
  FileSearch,
  KeyRound,
  Layers3,
  PlayCircle,
  Shield,
  Smartphone,
  Sparkles,
  Target,
} from 'lucide-react'
import {
  isAuthenticated,
  persistDesktopAuthSession,
  restoreDesktopAuthSession,
  setToken,
  setUser,
  syncStudyBuddyProfile,
} from '@/lib/auth'
import { checkPhoneRegistered, getProfile, passwordLogin, sendSmsCode, smsLogin, smsRegister } from '@/lib/api/real'
import './auth.css'

const SLOGANS = [
  '先识别基础、目标和薄弱点，再生成真正能执行的学习路径。',
  '资源、练习、报告和画像会互相回流，不让学习停在一次推荐里。',
  '每一次答题、复习和反馈，都会让 StudyBuddy 更懂你的节奏。',
  '把复杂的学习过程拆成今天能完成的下一步。',
] as const

const HERO_POINTS = [
  { value: '7 步', label: '画像到反馈闭环' },
  { value: '1 份', label: '动态学习画像' },
  { value: '持续', label: '弱点追踪与复盘' },
] as const

const ADVANTAGES = [
  {
    icon: BrainCircuit,
    title: '先理解人，再安排课',
    desc: '结合目标、基础、偏好和近期行为，形成可更新的学习画像，而不是给所有人同一套推荐。',
  },
  {
    icon: Target,
    title: '路径不是清单，是下一步',
    desc: '把长期目标拆成阶段任务、今日行动和补弱顺序，让学习者知道现在该做什么、为什么做。',
  },
  {
    icon: BookOpenCheck,
    title: '资源生成贴着问题走',
    desc: '围绕当前卡点生成讲解、例题、复习材料和练习，减少无效搜索和重复刷资料。',
  },
] as const

const LOOP_STEPS = [
  { icon: FileSearch, title: '画像构建', desc: '收集目标、基础、偏好与历史表现，建立学习起点。' },
  { icon: Layers3, title: '路径规划', desc: '拆解阶段目标，排出优先级、节奏和今日任务。' },
  { icon: PlayCircle, title: '互动学习', desc: '通过讲解、资源、练习和陪伴式问答推进学习。' },
  { icon: ChartNoAxesCombined, title: '反馈更新', desc: '根据练习结果和学习行为更新画像，继续收敛下一步。' },
] as const

type AuthResultUser = {
  id?: string
  user_id?: string
  name?: string
  phone?: string
  is_demo?: boolean
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('password')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [sloganIndex, setSloganIndex] = useState(0)
  const [displayText, setDisplayText] = useState<string>(SLOGANS[0])
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
        }, 44)
      } else {
        timerRef.current = setTimeout(() => setIsDeleting(true), 2200)
      }
    } else if (displayText.length > 0) {
      timerRef.current = setTimeout(() => {
        setDisplayText(displayText.slice(0, -1))
      }, 22)
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

  const showToast = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 2200)
  }, [])

  function validatePasswordInput() {
    if (password.length < 8) return '密码至少需要 8 位'
    if (!/[A-Za-z]/.test(password)) return '密码需要包含字母'
    if (!/\d/.test(password)) return '密码需要包含数字'
    return ''
  }

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
      // 尚未完成画像时，引导进入采集流程。
    }

    return '/onboarding'
  }

  async function handleSendCode() {
    if (phone.length !== 11) {
      showToast('请输入正确的 11 位手机号')
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
      showToast('请输入正确的 11 位手机号')
      return
    }
    if ((loginMethod === 'sms' || !isLogin) && code.length !== 6) {
      showToast('请输入 6 位验证码')
      return
    }
    if (loginMethod === 'password' || !isLogin) {
      const passwordError = validatePasswordInput()
      if (passwordError) {
        showToast(passwordError)
        return
      }
    }
    if (!isLogin && password !== confirmPassword) {
      showToast('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const result = mode === 'register'
        ? await smsRegister(phone, code, name, password)
        : loginMethod === 'password'
          ? await passwordLogin(phone, password)
          : await smsLogin(phone, code)

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
      <header className="brand" aria-label="SparkLearn">
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
          <span className="brand-sub">个性化学习多智能体平台</span>
        </div>
      </header>

      <section className="hero-layout">
        <div className="hero-copy">
          <h1 className="hero-title">
            让每个学习者
            <span>都有自己的 AI 学习闭环</span>
          </h1>
          <p className="hero-desc">
            {displayText}
            <span className="typewriter-cursor">|</span>
          </p>

          <div className="hero-actions">
            <a className="hero-primary" href="#login-panel">
              开始学习
              <ArrowRight size={18} />
            </a>
            <a className="hero-secondary" href="#learning-loop">查看优势</a>
          </div>

          <div className="hero-proof" aria-label="SparkLearn 核心能力">
            {HERO_POINTS.map((item) => (
              <div className="proof-item" key={item.label}>
                <b>{item.value}</b>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <Image
            src="/assets/generated/backgrounds/auth-sparklearn-cockpit-v2.png"
            alt=""
            fill
            className="hero-visual-img"
            sizes="(max-width: 980px) 100vw, 58vw"
            priority
          />
        </div>

        <aside className="login-card" id="login-panel">
          <div className="login-card-head">
            <div>
              <h2 className="login-title">{isLogin ? '欢迎回来' : '创建账号'}</h2>
              <p className="login-sub">
                {isLogin ? '继续你的个性化学习进度' : '注册后开始你的 StudyBuddy 学习闭环'}
              </p>
            </div>
            <div className="login-safe">
              <Shield size={16} />
              安全验证
            </div>
          </div>

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
                setConfirmPassword('')
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
                setLoginMethod('sms')
                setCodeSent(false)
                setCode('')
              }}
            >
              注册
            </button>
          </div>

          {isLogin ? (
            <div className="auth-method-tabs" role="tablist" aria-label="登录方式切换">
              <button
                className={`auth-method-tab ${loginMethod === 'password' ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={loginMethod === 'password'}
                onClick={() => setLoginMethod('password')}
              >
                密码登录
              </button>
              <button
                className={`auth-method-tab ${loginMethod === 'sms' ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={loginMethod === 'sms'}
                onClick={() => setLoginMethod('sms')}
              >
                验证码登录
              </button>
            </div>
          ) : null}

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

            {(isLogin && loginMethod === 'password') || !isLogin ? (
              <div className="field">
                <KeyRound className="field-icon" size={18} strokeWidth={2} />
                <input
                  type="password"
                  placeholder={isLogin ? '请输入密码' : '请设置登录密码'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            ) : null}

            {!isLogin ? (
              <div className="field">
                <CheckCircle2 className="field-icon" size={18} strokeWidth={2} />
                <input
                  type="password"
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <p className="password-hint">至少 8 位，包含字母和数字。演示账号可用手机号 + 密码直接进入完整演示空间。</p>
              </div>
            ) : null}

            {(isLogin && loginMethod === 'sms') || !isLogin ? (
              <div className="field code-field">
              <KeyRound className="field-icon" size={18} strokeWidth={2} />
              <input
                type="text"
                placeholder="请输入 6 位验证码"
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
            ) : null}

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
            <Shield size={16} />
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

      <section className="advantage-section" aria-label="SparkLearn 优势">
        <div className="section-head">
          <h2>不只是推荐资源，而是把学习推进下去</h2>
          <p>首页需要讲清楚价值：SparkLearn 的优势不是“有 AI”，而是让画像、路径、资源、练习和反馈形成闭环。</p>
        </div>

        <div className="advantage-grid">
          {ADVANTAGES.map((item) => {
            const Icon = item.icon
            return (
              <article className="advantage-card" key={item.title}>
                <div className="advantage-icon" aria-hidden="true">
                  <Icon size={22} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="loop-section" id="learning-loop" aria-label="学习闭环">
        <div className="loop-panel">
          <div className="loop-copy">
            <h2>一套可持续变聪明的学习闭环</h2>
            <p>
              学习不是看完一份资料就结束。SparkLearn 会把每次互动变成画像更新，再反过来影响下一次路径规划。
            </p>
          </div>
          <div className="loop-steps">
            {LOOP_STEPS.map((item, index) => {
              const Icon = item.icon
              return (
                <article className="loop-step" key={item.title}>
                  <div className="loop-index">{String(index + 1).padStart(2, '0')}</div>
                  <Icon size={21} />
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="closing-strip" aria-label="登录提示">
        <div>
          <Sparkles size={22} />
          <span>登录后，系统会先确认你的画像是否完整，再进入学习工作台。</span>
        </div>
        <a href="#login-panel">
          现在进入
          <CheckCircle2 size={18} />
        </a>
      </section>

      <div className={`toast ${toast ? 'show' : ''}`}>
        {toast}
      </div>
    </main>
  )
}

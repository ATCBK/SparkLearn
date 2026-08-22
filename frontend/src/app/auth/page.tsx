'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, KeyRound, MessageCircle, Shield, Smartphone, X } from 'lucide-react'
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
  '基于学习目标、当前基础和偏好生成个性化学习路径。',
  '把学习画像、资源推荐、练习反馈和报告串成闭环。',
  '优先定位薄弱点，再给出更可执行的下一步动作。',
  '随着学习行为积累，StudyBuddy 会越来越理解你的节奏。',
] as const

type AuthResultUser = {
  id?: string
  user_id?: string
  name?: string
  phone?: string
  is_demo?: boolean
}

type AgreementType = 'terms' | 'privacy'

const AGREEMENTS: Record<AgreementType, {
  title: string
  updatedAt: string
  sections: Array<{
    heading: string
    body: string
  }>
}> = {
  terms: {
    title: '用户协议',
    updatedAt: '2026年7月18日',
    sections: [
      {
        heading: '一、服务说明',
        body: 'SparkLearn 是面向学习者的个性化学习平台，会基于你的学习目标、基础水平、学习偏好和练习表现，提供学习路径规划、资源推荐、AI 辅导、练习评测和学习报告等服务。',
      },
      {
        heading: '二、账号使用',
        body: '你应使用真实、有效的手机号注册或登录账号，并妥善保管验证码、密码和设备登录状态。因账号信息泄露、转借他人或异常使用造成的风险，需要由账号使用者自行承担。',
      },
      {
        heading: '三、学习内容与 AI 回答',
        body: '平台提供的学习建议、AI 讲解、练习解析和资源推荐仅用于学习辅助，不替代教师、学校或专业机构的正式判断。你应结合课程要求、教材和教师意见进行学习决策。',
      },
      {
        heading: '四、用户行为规范',
        body: '你不得利用平台发布违法违规、侵权、骚扰、作弊、恶意攻击或破坏系统稳定性的内容，也不得尝试绕过安全策略、批量抓取数据或干扰其他用户正常使用。',
      },
      {
        heading: '五、知识产权',
        body: '平台的界面、功能、算法、学习资源组织方式和系统内容受相关法律保护。你在平台中上传或生成的学习资料仍归原权利人所有，但你授权平台在提供学习服务所必需的范围内进行处理和展示。',
      },
      {
        heading: '六、协议变更',
        body: '我们可能根据产品能力、法律法规或运营需要更新本协议。重要变更会在页面内提示；你继续使用 SparkLearn，即表示接受更新后的协议内容。',
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    updatedAt: '2026年7月18日',
    sections: [
      {
        heading: '一、我们收集的信息',
        body: '为了完成登录、个性化学习和学习进度同步，我们可能收集手机号、昵称、学习目标、专业方向、知识水平、薄弱点、学习偏好、对话记录、练习记录、收藏记录和学习报告等信息。',
      },
      {
        heading: '二、信息使用目的',
        body: '这些信息会用于账号识别、登录状态保持、学习画像构建、路径规划、资源生成、AI 辅导上下文理解、练习评测、反馈报告生成以及服务安全风控。',
      },
      {
        heading: '三、信息存储与保护',
        body: '我们会采取合理的技术和管理措施保护你的个人信息，限制无关访问，并尽量只在实现学习服务所需的范围内保存数据。请你也妥善保管账号密码和设备安全。',
      },
      {
        heading: '四、信息共享',
        body: '除法律法规要求、获得你的明确同意、完成你主动请求的功能或保障系统安全所必需的情况外，我们不会将你的个人信息出售或提供给无关第三方。',
      },
      {
        heading: '五、你的权利',
        body: '你可以在产品支持范围内查看、修改学习资料和个人信息，也可以要求清除不再需要的学习记录。部分数据删除后，个性化推荐、历史回顾和学习报告可能受到影响。',
      },
      {
        heading: '六、未成年人保护',
        body: '如你是未成年人，应在监护人同意和指导下使用 SparkLearn。我们会在合理范围内保护未成年人的学习数据和个人信息。',
      },
    ],
  },
}

function profileCollectedKey(userId?: string) {
  return userId ? `sparklearn_profile_collected_at:${userId}` : ''
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [name, setName] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [sloganIndex, setSloganIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeAgreement, setActiveAgreement] = useState<AgreementType | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const currentSlogan = useMemo(() => SLOGANS[sloganIndex], [sloganIndex])
  const agreementContent = activeAgreement ? AGREEMENTS[activeAgreement] : null

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
      if (userId && localStorage.getItem(profileCollectedKey(userId))) {
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

    if ((loginMethod === 'sms' || mode === 'register') && code.length !== 6) {
      showToast('请输入6位验证码')
      return
    }

    if (loginMethod === 'password' || mode === 'register') {
      const passwordError = validatePasswordInput()
      if (passwordError) {
        showToast(passwordError)
        return
      }
    }

    if (mode === 'register' && password !== confirmPassword) {
      showToast('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const result = mode === 'login'
        ? loginMethod === 'password'
          ? await passwordLogin(phone, password)
          : await smsLogin(phone, code)
        : await smsRegister(phone, code, name, password)

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
          src="/sparklearn-logo-official.png"
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
                setLoginMethod('password')
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
                setLoginMethod('sms')
                setCodeSent(false)
                setCode('')
              }}
            >
              注册
            </button>
          </div>

          {isLogin ? (
            <div className="auth-method-tabs" role="tablist" aria-label="登录方式切换" data-method={loginMethod}>
              <button
                className={`auth-method-tab ${loginMethod === 'password' ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={loginMethod === 'password'}
                onClick={() => setLoginMethod('password')}
              >
                <KeyRound size={16} strokeWidth={2.4} />
                密码登录
              </button>
              <button
                className={`auth-method-tab ${loginMethod === 'sms' ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={loginMethod === 'sms'}
                onClick={() => setLoginMethod('sms')}
              >
                <MessageCircle size={16} strokeWidth={2.4} />
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

            {loginMethod === 'password' || !isLogin ? (
              <>
                <div className="field">
                  <KeyRound className="field-icon" size={18} strokeWidth={2} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isLogin ? '请输入密码' : '请设置登录密码'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
                  </button>
                </div>
                {!isLogin ? (
                  <>
                    <div className="field">
                      <KeyRound className="field-icon" size={18} strokeWidth={2} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="请再次输入密码"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="eye-btn"
                        aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
                      </button>
                    </div>
                    <p className="password-hint">密码至少 8 位，需包含字母和数字。</p>
                  </>
                ) : null}
              </>
            ) : null}

            {loginMethod === 'sms' || !isLogin ? (
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
            <Shield size={18} className="text-[#8a99b0]" />
            <span>
              登录即表示同意
              {' '}
              <button type="button" onClick={() => setActiveAgreement('terms')}>《用户协议》</button>
              {' '}
              与
              {' '}
              <button type="button" onClick={() => setActiveAgreement('privacy')}>《隐私政策》</button>
            </span>
          </div>
        </aside>
      </section>

      {agreementContent ? (
        <div
          className="agreement-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agreement-title"
          onClick={() => setActiveAgreement(null)}
        >
          <article className="agreement-panel" onClick={(event) => event.stopPropagation()}>
            <header className="agreement-panel-header">
              <div>
                <p className="agreement-kicker">SparkLearn 服务条款</p>
                <h2 id="agreement-title">{agreementContent.title}</h2>
                <span>更新日期：{agreementContent.updatedAt}</span>
              </div>
              <button
                type="button"
                className="agreement-close"
                aria-label="关闭协议内容"
                onClick={() => setActiveAgreement(null)}
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </header>

            <div className="agreement-panel-body">
              {agreementContent.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </section>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      <div className={`toast ${toast ? 'show' : ''}`}>
        {toast}
      </div>
    </main>
  )
}

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react'
import { NanobotDesktopPanel } from '@/components/desktop/NanobotDesktopPanel'
import './auth.css'

const SLOGANS = [
  '基于你的目标、基础与学习偏好，智能规划专属学习路径，精准推荐资源，陪伴你高效成长。',
  '多智能体协作驱动，实时分析学习行为，动态调整路径节奏，让每一步都恰到好处。',
  '从知识薄弱点出发，AI 精准定位问题根源，生成专属练习与讲解，高效突破瓶颈。',
  '学习画像持续进化，越学越懂你，资源推荐越来越精准，成长看得见。',
]

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 打字机效果
  const [sloganIndex, setSloganIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const currentSlogan = SLOGANS[sloganIndex]

    if (!isDeleting) {
      // 打字
      if (displayText.length < currentSlogan.length) {
        timerRef.current = setTimeout(() => {
          setDisplayText(currentSlogan.slice(0, displayText.length + 1))
        }, 50)
      } else {
        // 打完了，等一会再删
        timerRef.current = setTimeout(() => setIsDeleting(true), 2500)
      }
    } else {
      // 删字
      if (displayText.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, 25)
      } else {
        // 删完了，切换下一条
        timerRef.current = setTimeout(() => {
          setIsDeleting(false)
          setSloganIndex((prev) => (prev + 1) % SLOGANS.length)
        }, 25)
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [displayText, isDeleting, sloganIndex])

  const showToast = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 2200)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !password) {
      showToast('请填写邮箱和密码')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      showToast('两次输入的密码不一致')
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const userName = email.split('@')[0] || '学习者'
      if (typeof window !== 'undefined') {
        localStorage.setItem('sparklearn_token', `demo_user_token_${Date.now()}`)
        localStorage.setItem(
          'sparklearn_user',
          JSON.stringify({
            email,
            name: userName,
            loginAt: new Date().toISOString(),
          }),
        )
        localStorage.setItem('sparklearn_profile_needs_recapture', 'true')
      }
      if (mode === 'login') {
        router.push('/onboarding')
      } else {
        showToast('注册成功，即将跳转...')
        setTimeout(() => router.push('/onboarding'), 800)
      }
    }, 850)
  }

  const isLogin = mode === 'login'

  return (
    <main className="auth-page">
      {/* Brand */}
      <div className="brand">
        <Image
          src="/sparklearn-logo.png"
          alt="学而思 SparkLearn"
          width={68}
          height={56}
          className="brand-logo"
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
        <div>
          <strong className="brand-name">学而思 SparkLearn</strong>
          <span className="brand-sub">智能个性化学习平台</span>
        </div>
      </div>

      <section className="layout">
        {/* Left intro */}
        <div className="intro">
          <h1 className="intro-title">
            让学习更懂你
            <span className="intro-title-accent">成就每一次进步</span>
          </h1>
          <p className="intro-desc">
            {displayText}<span className="typewriter-cursor">|</span>
          </p>

          <div className="feature-row">
            {/* Feature 1 - 学习画像 */}
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} className="w-[18px] h-[18px]">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21a7 7 0 0 1 14 0" />
                  <path d="M6.5 12.5a8 8 0 0 0 11 0" />
                </svg>
              </div>
              <h2 className="feature-title">学习画像</h2>
              <p className="feature-desc">数据驱动的个性化分析<br />全面了解你的学习情况</p>
              <div className="mini-pill">知识掌握度 72%</div>
              <div className="progress-bar">
                <i className="progress-fill" style={{ width: '72%' }} />
              </div>
            </article>

            {/* Feature 2 - 学习路径 */}
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} className="w-[18px] h-[18px]">
                  <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <h2 className="feature-title">当前学习路径</h2>
              <p className="feature-desc">函数与导数进阶<br />第 3/8 阶段 · 进行中</p>
              <div className="path-dots" aria-hidden="true">
                <span className="dot dot-1" />
                <span className="dot dot-2" />
                <span className="dot dot-3" />
              </div>
            </article>

            {/* Feature 3 - 今日推荐 */}
            <article className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} className="w-[18px] h-[18px]">
                  <rect x="6" y="4" width="12" height="16" rx="2" />
                  <path d="M9 8h6M9 12h6M9 16h3" />
                  <path d="m16 3 1.5 2.5" />
                </svg>
              </div>
              <h2 className="feature-title">今日推荐任务</h2>
              <p className="feature-desc">导数的应用练习<br />巩固知识 · 提升能力</p>
              <div className="action-line">
                <b>去学习</b>
                <span>→</span>
              </div>
            </article>
          </div>
        </div>

        {/* Right login card */}
        <aside className="login-card">
          <h2 className="login-title">{isLogin ? '欢迎回来' : '创建账号'}</h2>
          <p className="login-sub">
            {isLogin ? '登录后重新采集学习画像，继续你的个性化学习之旅' : '注册后先完成学习画像采集，再进入学习空间'}
          </p>

          {/* Tabs */}
          <div className="tabs" role="tablist" aria-label="登录注册切换">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={!isLogin}
              onClick={() => setMode('register')}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <Mail className="field-icon" size={18} strokeWidth={2} />
              <input
                type="email"
                placeholder="请输入邮箱"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <Lock className="field-icon" size={18} strokeWidth={2} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="eye-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="显示或隐藏密码"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {!isLogin && (
              <div className="field">
                <Lock className="field-icon" size={18} strokeWidth={2} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  className="eye-btn"
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="显示或隐藏确认密码"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            <div className="form-row">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>记住我</span>
              </label>
              <button
                className="forgot-btn"
                type="button"
                onClick={() => showToast('密码找回暂未接入，请联系老师或管理员。')}
              >
                忘记密码？
              </button>
            </div>

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading
                ? (isLogin ? '正在登录...' : '正在注册...')
                : (isLogin ? '立即登录' : '立即注册')
              }
            </button>
          </form>

          <div className="agreement">
            <Shield size={18} className="text-[#8a99b0]" />
            <span>
              登录即表示同意{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>《用户协议》</a>
              {' '}与{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>《隐私政策》</a>
            </span>
          </div>
        </aside>
      </section>

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''}`}>
        {toast}
      </div>
      <NanobotDesktopPanel />
    </main>
  )
}

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Smartphone, Shield, KeyRound } from 'lucide-react'
import { setToken, setUser } from '@/lib/auth'
import { sendSmsCode, smsLogin, smsRegister, checkPhoneRegistered } from '@/lib/api/real'
import './auth.css'

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

  // 打字机效果
  const SLOGANS = [
    '基于你的目标、基础与学习偏好，智能规划专属学习路径，精准推荐资源，陪伴你高效成长。',
    '多智能体协作驱动，实时分析学习行为，动态调整路径节奏，让每一步都恰到好处。',
    '从知识薄弱点出发，AI 精准定位问题根源，生成专属练习与讲解，高效突破瓶颈。',
    '学习画像持续进化，越学越懂你，资源推荐越来越精准，成长看得见。',
  ]
  const [sloganIndex, setSloganIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const currentSlogan = SLOGANS[sloganIndex]

    if (!isDeleting) {
      if (displayText.length < currentSlogan.length) {
        timerRef.current = setTimeout(() => {
          setDisplayText(currentSlogan.slice(0, displayText.length + 1))
        }, 50)
      } else {
        timerRef.current = setTimeout(() => setIsDeleting(true), 2500)
      }
    } else {
      if (displayText.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, 25)
      } else {
        setIsDeleting(false)
        setSloganIndex((prev) => (prev + 1) % SLOGANS.length)
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [displayText, isDeleting, sloganIndex])

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const showToast = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast(null), 2200)
  }, [])

  async function handleSendCode() {
    if (!phone || phone.length !== 11) {
      showToast('请输入正确的11位手机号')
      return
    }
    try {
      setLoading(true)

      // 登录模式下，先检查手机号是否已注册
      if (mode === 'login') {
        const { registered } = await checkPhoneRegistered(phone)
        if (!registered) {
          showToast('该手机号未注册，请先注册')
          setMode('register')
          setLoading(false)
          return
        }
      }

      await sendSmsCode(phone, mode)
      setCodeSent(true)
      setCountdown(60)
      showToast('验证码已发送')
    } catch (err: any) {
      showToast(err.message || '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!phone || phone.length !== 11) {
      showToast('请输入正确的11位手机号')
      return
    }
    if (!code || code.length !== 6) {
      showToast('请输入6位验证码')
      return
    }

    setLoading(true)
    try {
      let result
      if (mode === 'login') {
        try {
          result = await smsLogin(phone, code)
        } catch (loginErr: any) {
          // 如果登录时手机号未注册，自动切换到注册模式
          if (loginErr.message && loginErr.message.includes('未注册')) {
            showToast('该手机号未注册，请先注册')
            setMode('register')
            setLoading(false)
            return
          }
          throw loginErr
        }
      } else {
        result = await smsRegister(phone, code, name)
      }

      // 保存 token 和用户信息
      setToken(result.token)
      setUser(result.user)

      showToast(mode === 'login' ? '登录成功' : '注册成功')
      setTimeout(() => router.push('/onboarding'), 500)
    } catch (err: any) {
      showToast(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
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
            {isLogin ? '使用手机号登录继续你的学习之旅' : '注册后开启你的个性化学习之旅'}
          </p>

          {/* Tabs */}
          <div className="tabs" role="tablist" aria-label="登录注册切换">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => { setMode('login'); setCodeSent(false); setCode('') }}
            >
              登录
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={!isLogin}
              onClick={() => { setMode('register'); setCodeSent(false); setCode('') }}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <Smartphone className="field-icon" size={18} strokeWidth={2} />
              <input
                type="tel"
                placeholder="请输入手机号"
                autoComplete="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {!isLogin && (
              <div className="field">
                <svg className="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21a7 7 0 0 1 14 0" />
                </svg>
                <input
                  type="text"
                  placeholder="请输入昵称（选填）"
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="field code-field">
              <KeyRound className="field-icon" size={18} strokeWidth={2} />
              <input
                type="text"
                placeholder="请输入6位验证码"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <button
                className="send-code-btn"
                type="button"
                onClick={handleSendCode}
                disabled={loading || countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : (codeSent ? '重新发送' : '获取验证码')}
              </button>
            </div>

            <div className="form-row">
              <label className="check-label">
                <input type="checkbox" defaultChecked />
                <span>记住登录状态</span>
              </label>
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
    </main>
  )
}

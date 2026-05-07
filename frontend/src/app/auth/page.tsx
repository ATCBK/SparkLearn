'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [remember, setRemember] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand */}
      <div
        className="w-1/2 flex flex-col items-center justify-center p-16 text-white"
        style={{ background: 'linear-gradient(135deg, #1d1d1f, #2c2c2e)' }}
      >
        {/* Logo */}
        <div className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, #0071e3, #5ac8fa)' }}
        >
          <span className="text-[32px] font-bold text-white">S</span>
        </div>

        {/* Name */}
        <h1 className="text-h1 font-bold text-white/90 mb-2">SparkLearn</h1>

        {/* Subtitle */}
        <p className="text-body text-white/40 mb-10 max-w-[300px] text-center">
          AI 驱动的个性化学习平台
        </p>

        {/* Data Highlights */}
        <div className="flex gap-12">
          <div className="text-center">
            <div className="text-h2 font-bold text-white/80">10w+</div>
            <div className="text-micro text-white/30 mt-1">学习用户</div>
          </div>
          <div className="text-center">
            <div className="text-h2 font-bold text-white/80">95%</div>
            <div className="text-micro text-white/30 mt-1">提分率</div>
          </div>
          <div className="text-center">
            <div className="text-h2 font-bold text-white/80">50+</div>
            <div className="text-micro text-white/30 mt-1">课程覆盖</div>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="w-1/2 flex items-center justify-center p-16 bg-bg">
        <div className="w-full max-w-[340px]">
          {/* Tabs */}
          <div className="flex gap-1 bg-bg-hover p-1 rounded-[12px] mb-7">
            <button
              onClick={() => setTab('login')}
              className={cn(
                'flex-1 py-2.5 rounded-[10px] text-small font-medium transition-colors',
                tab === 'login'
                  ? 'bg-bg-card text-ink shadow-sm'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              登录
            </button>
            <button
              onClick={() => setTab('register')}
              className={cn(
                'flex-1 py-2.5 rounded-[10px] text-small font-medium transition-colors',
                tab === 'register'
                  ? 'bg-bg-card text-ink shadow-sm'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="邮箱" type="email" placeholder="请输入邮箱" />

            <div className="relative">
              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-ink-disabled hover:text-ink-secondary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {tab === 'register' && (
              <div className="relative">
                <Input
                  label="确认密码"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="请再次输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-[38px] text-ink-disabled hover:text-ink-secondary transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-black/10 text-blue focus:ring-blue/20"
                />
                <span className="text-small text-ink-secondary">记住我</span>
              </label>
              <button type="button" className="text-small text-blue hover:underline">
                忘记密码？
              </button>
            </div>

            <Button className="w-full" size="lg" type="submit">
              {tab === 'login' ? '登录' : '注册'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

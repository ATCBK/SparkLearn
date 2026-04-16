'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // In real app, would call auth API
    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand */}
      <div className="w-2/5 bg-ink flex flex-col items-center justify-center p-12 text-white">
        <div className="w-16 h-16 rounded-2xl bg-blue flex items-center justify-center mb-6">
          <span className="text-2xl font-bold">学</span>
        </div>
        <h1 className="text-h1 mb-2">SparkLearn</h1>
        <p className="text-body text-white/60 text-center max-w-xs">
          AI 驱动的个性化学习平台
        </p>
        <p className="text-small text-white/40 text-center mt-4 max-w-xs">
          7 个 AI Agent 协同工作，为你打造专属的学习路径和资源
        </p>
      </div>

      {/* Right - Form */}
      <div className="w-3/5 flex items-center justify-center p-12 bg-bg">
        <div className="w-full max-w-md space-y-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-bg-hover p-1 rounded-[12px]">
            <button
              onClick={() => setTab('login')}
              className={cn(
                'flex-1 py-2.5 rounded-[10px] text-small font-medium transition-colors',
                tab === 'login' ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-secondary hover:text-ink',
              )}
            >
              登录
            </button>
            <button
              onClick={() => setTab('register')}
              className={cn(
                'flex-1 py-2.5 rounded-[10px] text-small font-medium transition-colors',
                tab === 'register' ? 'bg-bg-card text-ink shadow-sm' : 'text-ink-secondary hover:text-ink',
              )}
            >
              注册
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="邮箱" type="email" placeholder="请输入邮箱" />
            <Input label="密码" type="password" placeholder="请输入密码" />
            {tab === 'register' && (
              <Input label="确认密码" type="password" placeholder="请再次输入密码" />
            )}
            <Button className="w-full mt-2" size="lg">
              {tab === 'login' ? '登录' : '注册'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-black/[0.06]" />
            <span className="text-caption text-ink-tertiary">或</span>
            <div className="flex-1 h-px bg-black/[0.06]" />
          </div>

          {/* Social Login */}
          <Button variant="secondary" className="w-full" size="lg">
            微信登录
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ShieldCheck, User } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (username === 'admin' && password === '123456') {
      localStorage.setItem('admin_token', 'demo_admin_token')
      router.push('/admin/dashboard')
    } else {
      setError('账号或密码错误，演示账号：admin / 123456')
    }
    setLoading(false)
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4"
      style={{
        backgroundImage: 'url(/gongzuotai-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-[420px] rounded-[16px] border border-[#e5e7eb] bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#2563eb] text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[#111827]">平台管理端</h1>
            <p className="mt-1 text-sm text-[#6b7280]">SparkLearn · 运营与权限中台</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#374151]">账号</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入管理员账号"
                className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#2563eb] focus:bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[#374151]">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#2563eb] focus:bg-white"
                required
              />
            </div>
          </div>

          {error && <div className="rounded-[8px] bg-[#fef2f2] px-3 py-2.5 text-xs text-[#dc2626]">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 w-full rounded-[10px] bg-[#2563eb] text-sm font-bold text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
          >
            {loading ? '登录中...' : '登录管理端'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#9ca3af]">演示账号：admin / 密码：123456</p>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Lock, ExternalLink, AlertCircle } from 'lucide-react'

interface ShareInfo {
  share_code: string
  title: string
  resource_type: string
  access_type: string
  needs_password: boolean
  view_count: number
  created_at: string
}

export default function ShareAccessPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [info, setInfo] = useState<ShareInfo | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resourceId, setResourceId] = useState('')

  useEffect(() => {
    fetchInfo()
  }, [code])

  async function fetchInfo() {
    try {
      const res = await fetch(`/api/sharing/${code}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '获取失败')
      setInfo(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccess() {
    try {
      const res = await fetch(`/api/sharing/${code}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '访问失败')
      setResourceId(json.data.resource_id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8fb]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#6b7280]">加载中...</p>
        </div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8fb]">
        <div className="text-center max-w-sm">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-semibold text-[#111827] mb-2">无法访问</h2>
          <p className="text-sm text-[#6b7280] mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 rounded-xl bg-[#2563eb] text-white text-sm font-medium"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (resourceId) {
    // 资源已解锁，跳转到资源页面
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8fb]">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <ExternalLink size={24} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-[#111827] mb-2">资源已解锁</h2>
          <p className="text-sm text-[#6b7280] mb-4">{info?.title || '正在跳转...'}</p>
          <button
            onClick={() => router.push(`/resources/${resourceId}`)}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#075ff0] to-[#5aa2ff] text-white text-sm font-semibold"
          >
            查看资源
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f8fb]">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#eff6ff] flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-[#2563eb]" />
          </div>
          <h1 className="text-xl font-bold text-[#111827] mb-1">{info?.title || '分享资料'}</h1>
          <p className="text-sm text-[#6b7280]">
            {info?.access_type === 'password' ? '此资料需要密码访问' : '点击下方按钮查看资料'}
          </p>
        </div>

        {info?.needs_password && (
          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密码"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAccess()}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={handleAccess}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-[#075ff0] to-[#5aa2ff] text-white font-semibold text-sm hover:shadow-lg transition-all"
        >
          {info?.needs_password ? '验证并查看' : '查看资料'}
        </button>

        <p className="text-xs text-center text-[#9ca3af] mt-4">
          已被查看 {info?.view_count || 0} 次
        </p>
      </div>
    </div>
  )
}
